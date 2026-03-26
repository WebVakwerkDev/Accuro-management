from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import ClassVar
import re


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    APP_NAME: str = "AgencyOS"

    # Database
    DATABASE_URL: str
    POSTGRES_DB: str = "ticketsystem"
    POSTGRES_USER: str = "ticketsystem"
    POSTGRES_PASSWORD: str

    # Redis
    REDIS_URL: str
    REDIS_PASSWORD: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Rate limiting
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_EXTERNAL_API: str = "30/minute"
    RATE_LIMIT_GENERAL: str = "200/minute"

    # External API
    EXTERNAL_API_KEY: str = ""

    # Integrations
    GITHUB_TOKEN: str = ""
    DISCORD_TICKET_WEBHOOK_URL: str = ""

    # Seed — admin user
    SEED_ADMIN_EMAIL: str = "admin@example.com"
    SEED_ADMIN_PASSWORD: str = ""
    SEED_ADMIN_NAME: str = "Admin"

    # Seed — business settings (only applied once if no settings exist yet)
    SEED_COMPANY_NAME: str = ""
    SEED_COMPANY_EMAIL: str = ""
    SEED_COMPANY_PHONE: str = ""
    SEED_COMPANY_ADDRESS: str = ""
    SEED_COMPANY_WEBSITE: str = ""
    SEED_COMPANY_KVK: str = ""
    SEED_COMPANY_VAT: str = ""
    SEED_COMPANY_IBAN: str = ""
    SEED_COMPANY_ACCOUNT_HOLDER: str = ""

    # Computed
    SENSITIVE_FIELDS: ClassVar[set[str]] = {
        "password", "token", "secret", "key", "authorization",
        "cookie", "credential", "api_key", "apikey",
    }

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def parse_rate_limit(self, value: str) -> tuple[int, int]:
        """Parse '5/minute' into (count, seconds)."""
        match = re.match(r"(\d+)/(second|minute|hour)", value)
        if not match:
            return (100, 60)
        count = int(match.group(1))
        unit = match.group(2)
        seconds = {"second": 1, "minute": 60, "hour": 3600}[unit]
        return (count, seconds)

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def jwt_secret_min_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
