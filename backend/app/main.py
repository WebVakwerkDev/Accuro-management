from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text, select
import structlog

from app.config import get_settings
from app.database import engine, async_session
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.logging import RequestLoggingMiddleware

# Import all routers
from app.routers import (
    auth,
    users,
    clients,
    projects,
    communication,
    notes,
    invoices,
    proposals,
    repositories,
    links,
    finance,
    dashboard,
    settings as settings_router,
    export,
    external,
    time_entries,
    expenses,
    tasks,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("application_startup", env=settings.APP_ENV)

    # Seed admin user on first startup
    await _seed_admin_user()

    yield

    await engine.dispose()
    logger.info("application_shutdown")


async def _seed_admin_user():
    """Create initial admin user if no users exist."""
    from app.models.user import User
    from app.core.security import hash_password

    settings = get_settings()
    if not settings.SEED_ADMIN_EMAIL or not settings.SEED_ADMIN_PASSWORD:
        return

    async with async_session() as db:
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is not None:
            return

        admin = User(
            name=settings.SEED_ADMIN_NAME,
            email=settings.SEED_ADMIN_EMAIL.lower().strip(),
            password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info("admin_user_seeded", email=settings.SEED_ADMIN_EMAIL)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        openapi_url="/api/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # --- Middleware (order matters: last added = first executed) ---

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
    )

    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # Rate limiting
    app.add_middleware(RateLimitMiddleware)

    # Request logging
    app.add_middleware(RequestLoggingMiddleware)

    # --- Global exception handler ---
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", path=request.url.path, error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    # --- Health check ---
    @app.get("/api/v1/health", tags=["system"])
    async def health_check():
        errors = []

        # Check database
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as e:
            errors.append(f"database: {str(e)}")

        # Check Redis
        try:
            from app.core.auth import get_redis
            r = await get_redis()
            await r.ping()
        except Exception as e:
            errors.append(f"redis: {str(e)}")

        if errors:
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "errors": errors},
            )
        return {"status": "ok"}

    # --- Register routers ---
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(clients.router)
    app.include_router(projects.router)
    app.include_router(communication.router)
    app.include_router(notes.router)
    app.include_router(invoices.router)
    app.include_router(proposals.router)
    app.include_router(repositories.router)
    app.include_router(links.router)
    app.include_router(finance.router)
    app.include_router(dashboard.router)
    app.include_router(settings_router.router)
    app.include_router(export.router)
    app.include_router(external.router)
    app.include_router(time_entries.router)
    app.include_router(expenses.router)
    app.include_router(tasks.router)

    return app


app = create_app()
