[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $repo 'ai-service\.env'
$secureKey = $null
$plainKey = $null

if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'ai-service/.env est absent.'
}

try {
    $secureKey = Read-Host 'Clé Ollama Cloud' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $secureKey
    )
    try {
        $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            $pointer
        )
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }

    if ([string]::IsNullOrWhiteSpace($plainKey)) {
        throw 'La clé Ollama Cloud ne peut pas être vide.'
    }

    $lines = @(Get-Content -LiteralPath $envPath)
    $lines = @($lines | Where-Object {
        $_ -notmatch '^\s*SMARTCOMMERCE_AI_OLLAMA_API_KEY\s*='
    })
    $lines += "SMARTCOMMERCE_AI_OLLAMA_API_KEY=$plainKey"

    $temporary = "$envPath.tmp-$([guid]::NewGuid().ToString('N'))"
    try {
        [IO.File]::WriteAllLines(
            $temporary,
            $lines,
            [Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $temporary -Destination $envPath -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) {
            Remove-Item -LiteralPath $temporary -Force
        }
    }

    Write-Host 'Ollama Cloud key configured without display.'
} finally {
    $plainKey = $null
    $secureKey = $null
    [GC]::Collect()
}
