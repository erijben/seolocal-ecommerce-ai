[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$aiDir = Join-Path $repo 'ai-service'
$backendDir = Join-Path $repo 'backend'
$aiEnv = Join-Path $aiDir '.env'
$backendEnv = Join-Path $backendDir '.env'
$backendAutoload = Join-Path $backendDir 'vendor\autoload.php'
$backendBootstrap = Join-Path $backendDir 'bootstrap\app.php'
$tempDir = Join-Path ([IO.Path]::GetTempPath()) (
    'smartcommerce-pre-e2e5-' + [guid]::NewGuid().ToString('N')
)
$tempPython = Join-Path $tempDir 'provision_e2e.py'
$tempPhp = Join-Path $tempDir 'verify_laravel_key.php'

$dbPasswordSecure = $null
$dbPassword = $null
$existingApiKey = $null
$resolvedApiKey = $null
$backendOriginal = $null
$aiOriginal = $null
$pendingKeyId = $null
$tenantCreated = $false
$pendingCreated = $false
$rotationFinalized = $false

function Get-EnvValue {
    param([string] $Path, [string] $Name)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $matches = @(
        Get-Content -LiteralPath $Path |
            Where-Object {
                $_ -match ('^\s*' + [regex]::Escape($Name) + '\s*=')
            }
    )

    if ($matches.Count -eq 0) {
        return $null
    }

    $value = ($matches[-1] -split '=', 2)[1].Trim()
    if (
        $value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))
    ) {
        return $value.Substring(1, $value.Length - 2)
    }

    return $value
}

function Set-EnvValue {
    param([string] $Path, [string] $Name, [string] $Value)

    $lines = if (Test-Path -LiteralPath $Path) {
        @(Get-Content -LiteralPath $Path)
    } else {
        @()
    }

    $pattern = '^\s*' + [regex]::Escape($Name) + '\s*='
    $updated = @($lines | Where-Object { $_ -notmatch $pattern })
    $updated += "$Name=$Value"
    $temporary = "$Path.tmp-$([guid]::NewGuid().ToString('N'))"

    try {
        [IO.File]::WriteAllLines(
            $temporary,
            $updated,
            [Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $temporary -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) {
            Remove-Item -LiteralPath $temporary -Force
        }
    }
}

function Invoke-AiPython {
    param([string[]] $Arguments)

    $output = & docker run --rm `
        --network smartcommerce-ai-p13_default `
        -e SMARTCOMMERCE_AI_POSTGRES_HOST `
        -e SMARTCOMMERCE_AI_POSTGRES_PORT `
        -e SMARTCOMMERCE_AI_POSTGRES_DB `
        -e SMARTCOMMERCE_AI_POSTGRES_USER `
        -e SMARTCOMMERCE_AI_POSTGRES_PASSWORD `
        -e SMARTCOMMERCE_E2E_EXISTING_KEY `
        -e PYTHONPATH=/workspace `
        -v "${aiDir}:/workspace" `
        -v "${tempDir}:/work-temp:ro" `
        -w /workspace `
        smartcommerce-ai-p13-test:local `
        python /work-temp/provision_e2e.py @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Le script Python a échoué avec le code $LASTEXITCODE."
    }

    return ($output -join "`n")
}

try {
    foreach ($requiredPath in @(
        $aiDir,
        $backendDir,
        $backendEnv,
        $backendAutoload,
        $backendBootstrap
    )) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Chemin requis absent : $requiredPath"
        }
    }

    New-Item -ItemType Directory -Path $tempDir | Out-Null

    @'
import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select

from app.core.database import get_engine, get_session_factory
from app.models.api_key import ApiKey
from app.models.knowledge_document import KnowledgeDocument
from app.models.tenant import Tenant
from app.security.api_keys import hash_api_key
from app.services.api_key_service import create_api_key

TENANT_NAME = "SmartCommerce E2E"
TENANT_SLUG = "smartcommerce-e2e"
KEY_NAME = "laravel-e2e"


def is_valid_key(record: ApiKey, tenant: Tenant) -> bool:
    now = datetime.now(timezone.utc)
    return (
        tenant.status == "active"
        and record.is_active
        and record.revoked_at is None
        and (record.expires_at is None or record.expires_at > now)
    )


async def prepare() -> dict:
    candidate = os.environ.get("SMARTCOMMERCE_E2E_EXISTING_KEY", "")
    factory = get_session_factory()

    async with factory() as session:
        try:
            tenant = await session.scalar(
                select(Tenant).where(Tenant.slug == TENANT_SLUG)
            )
            tenant_created = False

            if tenant is None:
                tenant = Tenant(
                    name=TENANT_NAME,
                    slug=TENANT_SLUG,
                    status="active",
                )
                session.add(tenant)
                await session.flush()
                tenant_created = True
            elif tenant.status != "active":
                raise RuntimeError("Existing E2E tenant is not active.")

            current = await session.scalar(
                select(ApiKey).where(
                    ApiKey.tenant_id == tenant.id,
                    ApiKey.name == KEY_NAME,
                )
            )

            if (
                current is not None
                and candidate
                and current.key_hash == hash_api_key(candidate)
                and is_valid_key(current, tenant)
            ):
                await session.commit()
                return {
                    "mode": "reuse",
                    "tenant_id": str(tenant.id),
                    "key_id": str(current.id),
                    "tenant_created": tenant_created,
                }

            pending_name = "laravel-e2e-pending-" + os.urandom(6).hex()
            pending, plain_text = await create_api_key(
                session=session,
                tenant_id=tenant.id,
                name=pending_name,
            )
            await session.commit()

            return {
                "mode": "rotate",
                "tenant_id": str(tenant.id),
                "pending_key_id": str(pending.id),
                "tenant_created": tenant_created,
                "secret": plain_text,
            }
        except Exception:
            await session.rollback()
            raise


async def finalize(pending_id: UUID) -> dict:
    factory = get_session_factory()

    async with factory() as session:
        try:
            tenant = await session.scalar(
                select(Tenant).where(Tenant.slug == TENANT_SLUG)
            )
            if tenant is None or tenant.status != "active":
                raise RuntimeError("Active E2E tenant not found.")

            pending = await session.scalar(
                select(ApiKey).where(
                    ApiKey.id == pending_id,
                    ApiKey.tenant_id == tenant.id,
                )
            )
            if pending is None:
                raise RuntimeError("Pending E2E key not found.")

            current = await session.scalar(
                select(ApiKey).where(
                    ApiKey.tenant_id == tenant.id,
                    ApiKey.name == KEY_NAME,
                )
            )
            if current is not None and current.id != pending.id:
                await session.delete(current)
                await session.flush()

            pending.name = KEY_NAME
            await session.commit()
            return {"tenant_id": str(tenant.id), "key_id": str(pending.id)}
        except Exception:
            await session.rollback()
            raise


async def rollback_pending(pending_id: UUID, remove_tenant: bool) -> dict:
    factory = get_session_factory()

    async with factory() as session:
        try:
            tenant = await session.scalar(
                select(Tenant).where(Tenant.slug == TENANT_SLUG)
            )
            if tenant is None:
                return {"rolled_back": True}

            await session.execute(
                delete(ApiKey).where(
                    ApiKey.id == pending_id,
                    ApiKey.tenant_id == tenant.id,
                )
            )
            await session.flush()

            remaining_keys = await session.scalar(
                select(func.count(ApiKey.id)).where(
                    ApiKey.tenant_id == tenant.id
                )
            )
            remaining_documents = await session.scalar(
                select(func.count(KnowledgeDocument.id)).where(
                    KnowledgeDocument.tenant_id == tenant.id
                )
            )

            if (
                remove_tenant
                and remaining_keys == 0
                and remaining_documents == 0
            ):
                await session.delete(tenant)

            await session.commit()
            return {"rolled_back": True}
        except Exception:
            await session.rollback()
            raise


async def verify() -> dict:
    factory = get_session_factory()

    async with factory() as session:
        tenant = await session.scalar(
            select(Tenant).where(Tenant.slug == TENANT_SLUG)
        )
        if tenant is None:
            raise RuntimeError("E2E tenant not found.")

        key = await session.scalar(
            select(ApiKey).where(
                ApiKey.tenant_id == tenant.id,
                ApiKey.name == KEY_NAME,
            )
        )
        if key is None:
            raise RuntimeError("E2E API key not found.")

        return {
            "tenant_id": str(tenant.id),
            "tenant_name": tenant.name,
            "tenant_slug": tenant.slug,
            "tenant_status": tenant.status,
            "key_id": str(key.id),
            "key_name": key.name,
            "key_prefix": key.key_prefix,
            "key_active": key.is_active,
            "key_revoked": key.revoked_at is not None,
            "key_expired": (
                key.expires_at is not None
                and key.expires_at <= datetime.now(timezone.utc)
            ),
        }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "finalize", "rollback", "verify"])
    parser.add_argument("--pending-id")
    parser.add_argument("--tenant-created", action="store_true")
    args = parser.parse_args()

    try:
        if args.mode == "prepare":
            result = await prepare()
        elif args.mode == "finalize":
            result = await finalize(UUID(args.pending_id))
        elif args.mode == "rollback":
            result = await rollback_pending(
                UUID(args.pending_id), args.tenant_created
            )
        else:
            result = await verify()
        print(json.dumps(result))
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
'@ | Set-Content -LiteralPath $tempPython -Encoding UTF8

    @'
<?php
$backendPath = getenv('SMARTCOMMERCE_LARAVEL_BACKEND_PATH');

if (! is_string($backendPath) || $backendPath === '') {
    fwrite(STDERR, "Laravel backend path is missing.\n");
    exit(1);
}

$autoload = $backendPath . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
$bootstrap = $backendPath . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

if (! is_file($autoload) || ! is_file($bootstrap)) {
    fwrite(STDERR, "Laravel bootstrap files are unavailable.\n");
    exit(1);
}

require $autoload;
$app = require $bootstrap;
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo json_encode([
    'enabled' => (bool) config('services.ai_microservice.enabled'),
    'legacy_fallback_enabled' => (bool) config(
        'services.ai_microservice.legacy_fallback_enabled'
    ),
    'api_key_configured' => filled(
        config('services.ai_microservice.api_key')
    ),
], JSON_PRETTY_PRINT), PHP_EOL;
'@ | Set-Content -LiteralPath $tempPhp -Encoding UTF8

    # Toutes les validations statiques précèdent le prompt et toute mutation.
    & docker run --rm `
        -v "${tempDir}:/work-temp:ro" `
        smartcommerce-ai-p13-test:local `
        python -c "import ast, pathlib; ast.parse(pathlib.Path('/work-temp/provision_e2e.py').read_text(encoding='utf-8-sig'))"
    if ($LASTEXITCODE -ne 0) {
        throw 'La validation syntaxique Python a échoué.'
    }

    php -l $tempPhp
    if ($LASTEXITCODE -ne 0) {
        throw 'La validation syntaxique PHP a échoué.'
    }

    & docker run --rm `
        --network smartcommerce-ai-p13_default `
        -e PYTHONPATH=/workspace `
        -v "${aiDir}:/workspace" `
        -v "${tempDir}:/work-temp:ro" `
        -w /workspace `
        smartcommerce-ai-p13-test:local `
        python -c "import app.core.database; print('PASS: app import')"
    if ($LASTEXITCODE -ne 0) {
        throw 'La validation de l’import Python app a échoué.'
    }

    Write-Host 'PASS: temporary script paths and syntax'

    $dbPasswordSecure = Read-Host `
        'Mot de passe PostgreSQL smartcommerce_ai_p13' `
        -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $dbPasswordSecure
    )
    try {
        $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            $pointer
        )
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    if ([string]::IsNullOrEmpty($dbPassword)) {
        throw 'Le mot de passe PostgreSQL ne peut pas être vide.'
    }

    $aiOriginal = if (Test-Path -LiteralPath $aiEnv) {
        [IO.File]::ReadAllText($aiEnv)
    } else {
        $null
    }
    $backendOriginal = [IO.File]::ReadAllText($backendEnv)

    Set-EnvValue $aiEnv 'SMARTCOMMERCE_AI_POSTGRES_HOST' '127.0.0.1'
    Set-EnvValue $aiEnv 'SMARTCOMMERCE_AI_POSTGRES_PORT' '55433'
    Set-EnvValue $aiEnv 'SMARTCOMMERCE_AI_POSTGRES_DB' 'smartcommerce_ai_p13'
    Set-EnvValue $aiEnv 'SMARTCOMMERCE_AI_POSTGRES_USER' 'smartcommerce_ai_p13'
    Set-EnvValue $aiEnv 'SMARTCOMMERCE_AI_POSTGRES_PASSWORD' (
        ConvertTo-Json $dbPassword -Compress
    )

    $env:SMARTCOMMERCE_AI_POSTGRES_HOST = 'host.docker.internal'
    $env:SMARTCOMMERCE_AI_POSTGRES_PORT = '55433'
    $env:SMARTCOMMERCE_AI_POSTGRES_DB = 'smartcommerce_ai_p13'
    $env:SMARTCOMMERCE_AI_POSTGRES_USER = 'smartcommerce_ai_p13'
    $env:SMARTCOMMERCE_AI_POSTGRES_PASSWORD = $dbPassword

    $revisionOutput = & docker run --rm `
        --network smartcommerce-ai-p13_default `
        -e SMARTCOMMERCE_AI_POSTGRES_HOST `
        -e SMARTCOMMERCE_AI_POSTGRES_PORT `
        -e SMARTCOMMERCE_AI_POSTGRES_DB `
        -e SMARTCOMMERCE_AI_POSTGRES_USER `
        -e SMARTCOMMERCE_AI_POSTGRES_PASSWORD `
        -v "${aiDir}:/workspace" `
        -w /workspace `
        smartcommerce-ai-p13-test:local `
        python -m alembic current
    if (
        $LASTEXITCODE -ne 0 -or
        ($revisionOutput -join "`n") -notmatch '41d5c9dc71f8'
    ) {
        throw 'Connexion ou révision Alembic invalide.'
    }
    Write-Host 'PASS: PostgreSQL authenticated connection'
    Write-Host 'PASS: Alembic revision 41d5c9dc71f8'

    $existingApiKey = Get-EnvValue $backendEnv 'AI_MICROSERVICE_API_KEY'
    $env:SMARTCOMMERCE_E2E_EXISTING_KEY = if ($null -eq $existingApiKey) {
        ''
    } else {
        $existingApiKey
    }

    $prepared = (Invoke-AiPython @('prepare')) | ConvertFrom-Json
    if ($prepared.mode -eq 'reuse') {
        $resolvedApiKey = $existingApiKey
        Write-Host 'REUSED: existing valid laravel-e2e key'
    } elseif ($prepared.mode -eq 'rotate') {
        $resolvedApiKey = [string] $prepared.secret
        $pendingKeyId = [string] $prepared.pending_key_id
        $tenantCreated = [bool] $prepared.tenant_created
        $pendingCreated = $true

        if ([string]::IsNullOrWhiteSpace($resolvedApiKey)) {
            throw 'La clé générée est vide.'
        }

        try {
            Set-EnvValue $backendEnv 'AI_MICROSERVICE_API_KEY' $resolvedApiKey
            $null = (Invoke-AiPython @(
                'finalize', '--pending-id', $pendingKeyId
            )) | ConvertFrom-Json
            $rotationFinalized = $true
            Write-Host 'CREATED/ROTATED: laravel-e2e key'
        } catch {
            # L'ancienne clé n'est supprimée que dans la transaction finalize.
            # Si finalize échoue, son rollback la préserve.
            [IO.File]::WriteAllText(
                $backendEnv,
                $backendOriginal,
                [Text.UTF8Encoding]::new($false)
            )
            if ($pendingCreated -and -not $rotationFinalized) {
                $rollbackArguments = @(
                    'rollback', '--pending-id', $pendingKeyId
                )
                if ($tenantCreated) {
                    $rollbackArguments += '--tenant-created'
                }
                $null = Invoke-AiPython $rollbackArguments
            }
            throw
        }
    } else {
        throw 'Résultat de provisionnement inattendu.'
    }

    Push-Location $backendDir
    try {
        php artisan config:clear
        if ($LASTEXITCODE -ne 0) {
            throw 'php artisan config:clear a échoué.'
        }

        $env:SMARTCOMMERCE_LARAVEL_BACKEND_PATH = $backendDir
        php $tempPhp
        if ($LASTEXITCODE -ne 0) {
            throw 'La vérification Laravel a échoué.'
        }
    } finally {
        Pop-Location
    }

    $verified = (Invoke-AiPython @('verify')) | ConvertFrom-Json
    $verified | Select-Object `
        tenant_id, tenant_name, tenant_slug, tenant_status, `
        key_id, key_name, key_prefix, key_active, key_revoked, key_expired |
        Format-List

    git -C $repo check-ignore -v ai-service/.env backend/.env
    if ($LASTEXITCODE -ne 0) {
        throw 'Un fichier .env ne paraît pas ignoré par Git.'
    }

    Write-Host 'PRE-E2E.5: SUCCESS'
} catch {
    # Avant toute clé pending, une erreur restaure ai-service/.env.
    if (-not $pendingCreated) {
        if ($null -eq $aiOriginal) {
            if (Test-Path -LiteralPath $aiEnv) {
                Remove-Item -LiteralPath $aiEnv -Force
            }
        } else {
            [IO.File]::WriteAllText(
                $aiEnv,
                $aiOriginal,
                [Text.UTF8Encoding]::new($false)
            )
        }
    }
    throw
} finally {
    Remove-Item Env:SMARTCOMMERCE_AI_POSTGRES_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:SMARTCOMMERCE_AI_POSTGRES_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:SMARTCOMMERCE_AI_POSTGRES_DB -ErrorAction SilentlyContinue
    Remove-Item Env:SMARTCOMMERCE_AI_POSTGRES_USER -ErrorAction SilentlyContinue
    Remove-Item Env:SMARTCOMMERCE_AI_POSTGRES_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SMARTCOMMERCE_E2E_EXISTING_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SMARTCOMMERCE_LARAVEL_BACKEND_PATH -ErrorAction SilentlyContinue

    $dbPasswordSecure = $null
    $dbPassword = $null
    $existingApiKey = $null
    $resolvedApiKey = $null
    $backendOriginal = $null
    $aiOriginal = $null

    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
    [GC]::Collect()
}
