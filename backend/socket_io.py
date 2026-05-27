"""Socket.IO real-time integration mounted on the FastAPI ASGI app."""
import os
import logging
import socketio
import jwt
from bson import ObjectId

logger = logging.getLogger("lms.socket")

# ASGI-compatible Socket.IO server (allows same origins as FastAPI CORS)
_origins_env = os.environ.get("CORS_ORIGINS", "")
_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or "*"

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=_origins,
    logger=False, engineio_logger=False,
)


def _decode_user_id(token: str) -> str | None:
    if not token:
        return None
    try:
        secret = os.environ["JWT_SECRET"]
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except Exception:
        return None


@sio.event
async def connect(sid, environ, auth):
    """Auth via token in auth payload from the client."""
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    user_id = _decode_user_id(token)
    if not user_id:
        # Allow anonymous connection but don't join any room
        return True
    # Join a per-user room so we can target notifications
    await sio.enter_room(sid, f"user:{user_id}")
    await sio.save_session(sid, {"user_id": user_id})
    return True


@sio.event
async def disconnect(sid):
    sess = await sio.get_session(sid) if sid else {}
    user_id = (sess or {}).get("user_id")
    if user_id:
        await sio.leave_room(sid, f"user:{user_id}")


async def push_notification(user_id: str, payload: dict) -> None:
    """Emit a notification event to a specific user's room (no-op if no listeners)."""
    try:
        if isinstance(user_id, ObjectId):
            user_id = str(user_id)
        await sio.emit("notification", payload, room=f"user:{user_id}")
    except Exception as e:
        logger.warning("socket push failed: %s", e)
