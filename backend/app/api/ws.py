"""
WebSocket router — real-time test run progress.

Architecture:
- Client connects to /ws/run/{run_id} with a Bearer token as a query param.
- Server subscribes to the Redis channel "run:{run_id}" if Redis is available.
- Falls back to polling the database when Redis is unavailable.
- Each event published by the Celery task is forwarded to the client.
- Polling fallback: if WebSocket is unavailable, clients can poll GET /api/test-runs/{run_id}.
- Connection is closed when the run reaches a terminal state or the client disconnects.
"""
import asyncio
import json
from typing import Optional

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import User

log = structlog.get_logger()

router = APIRouter()

# Terminal run states — close connection after receiving one of these
_TERMINAL_EVENTS = {"run.finished", "run.error", "run.cancelled"}
_TERMINAL_STATUSES = {"passed", "failed", "error", "cancelled"}


async def _authenticate_ws(token: Optional[str]) -> Optional[str]:
    """Authenticate a WebSocket connection. Returns user_id or None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            return None
        # Verify user exists and is active
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
            user = result.scalar_one_or_none()
            return user_id if user else None
    except (JWTError, Exception):
        return None


async def _verify_run_ownership(run_id: str, user_id: str) -> bool:
    """Verify the user owns the run."""
    try:
        from app.models import TestRun, Project
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TestRun)
                .join(Project)
                .where(TestRun.id == run_id, Project.owner_id == user_id)
            )
            return result.scalar_one_or_none() is not None
    except Exception:
        return False


async def _redis_stream(websocket: WebSocket, run_id: str):
    """Stream events from Redis pub/sub."""
    import redis.asyncio as aioredis

    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"run:{run_id}")

    try:
        await websocket.send_json({"type": "ws.connected", "run_id": run_id})

        while True:
            try:
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ws.heartbeat"})
                continue

            if message and message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await websocket.send_json(data)

                    if data.get("type") in _TERMINAL_EVENTS:
                        break
                except (json.JSONDecodeError, Exception) as exc:
                    log.warning("ws.send_error", error=str(exc))
    finally:
        await pubsub.unsubscribe(f"run:{run_id}")
        await pubsub.aclose()
        await r.aclose()


async def _poll_stream(websocket: WebSocket, run_id: str):
    """Fallback: poll the database for run status updates when Redis is unavailable."""
    from app.models import TestRun, RunStatus

    await websocket.send_json({"type": "ws.connected", "run_id": run_id, "mode": "polling"})

    last_status = None
    for _ in range(600):  # Max ~10 minutes of polling at 1s intervals
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(TestRun).where(TestRun.id == run_id))
                run = result.scalar_one_or_none()
                if not run:
                    await websocket.send_json({"type": "run.error", "run_id": run_id, "error": "Run not found"})
                    break

                current_status = run.status.value if hasattr(run.status, 'value') else str(run.status)
                if current_status != last_status:
                    last_status = current_status
                    await websocket.send_json({
                        "type": "run.status",
                        "run_id": run_id,
                        "status": current_status,
                        "passed": run.passed_steps,
                        "failed": run.failed_steps,
                        "total": run.total_steps,
                    })

                if current_status in _TERMINAL_STATUSES:
                    await websocket.send_json({
                        "type": "run.finished",
                        "run_id": run_id,
                        "status": current_status,
                        "passed": run.passed_steps,
                        "failed": run.failed_steps,
                        "duration_ms": run.duration_ms,
                    })
                    break
        except Exception as exc:
            log.warning("ws.poll_error", error=str(exc))

        await asyncio.sleep(1)


@router.websocket("/run/{run_id}")
async def run_progress(
    websocket: WebSocket,
    run_id: str,
    token: Optional[str] = Query(None),
):
    """Stream real-time test run progress via WebSocket."""
    # Auth
    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if not await _verify_run_ownership(run_id, user_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    log.info("ws.connected", run_id=run_id, user_id=user_id)

    try:
        # Try Redis first, fall back to polling
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
            await r.ping()
            await r.aclose()
            await _redis_stream(websocket, run_id)
        except Exception:
            log.info("ws.redis_unavailable_fallback_to_polling", run_id=run_id)
            await _poll_stream(websocket, run_id)

    except WebSocketDisconnect:
        log.info("ws.disconnected", run_id=run_id)
    except Exception as exc:
        log.error("ws.error", run_id=run_id, error=str(exc))
        try:
            await websocket.close()
        except Exception:
            pass
    finally:
        log.info("ws.closed", run_id=run_id)
