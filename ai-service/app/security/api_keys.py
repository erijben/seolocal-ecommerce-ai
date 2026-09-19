import hashlib
import secrets
from dataclasses import dataclass


API_KEY_PREFIX = "scai_"
API_KEY_DISPLAY_LENGTH = 16
API_KEY_RANDOM_BYTES = 32


@dataclass(frozen=True)
class GeneratedApiKey:
    plain_text: str
    prefix: str
    hash: str


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(
        api_key.encode("utf-8")
    ).hexdigest()


def generate_api_key() -> GeneratedApiKey:
    random_part = secrets.token_urlsafe(
        API_KEY_RANDOM_BYTES
    )
    plain_text = f"{API_KEY_PREFIX}{random_part}"

    return GeneratedApiKey(
        plain_text=plain_text,
        prefix=plain_text[:API_KEY_DISPLAY_LENGTH],
        hash=hash_api_key(plain_text),
    )