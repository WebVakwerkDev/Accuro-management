import asyncio
import structlog
from arq import create_pool
from arq.connections import RedisSettings
from app.config import get_settings
from app.tasks.jobs import github_sync_job, agent_briefing_job

logger = structlog.get_logger()


def _parse_redis_url() -> RedisSettings:
    settings = get_settings()
    url = settings.REDIS_URL
    # redis://:password@host:port/db
    parts = url.replace("redis://", "").split("@")
    password = parts[0].replace(":", "") if len(parts) > 1 else None
    host_part = parts[-1]
    host_db = host_part.split("/")
    host_port = host_db[0].split(":")
    host = host_port[0]
    port = int(host_port[1]) if len(host_port) > 1 else 6379
    database = int(host_db[1]) if len(host_db) > 1 else 0

    return RedisSettings(
        host=host,
        port=port,
        password=password,
        database=database,
    )


async def startup(ctx):
    logger.info("worker_started")


async def shutdown(ctx):
    logger.info("worker_shutdown")


class WorkerSettings:
    functions = [github_sync_job, agent_briefing_job]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 5
    job_timeout = 300
    redis_settings = _parse_redis_url()


if __name__ == "__main__":
    from arq import run_worker
    run_worker(WorkerSettings)  # type: ignore
