import app.bootstrap_env  # noqa: E402 — loads .env before anything reads os.environ

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from starlette.responses import Response

from app.routers import ai, auth, geo, messages, metrics, project, redis_health, supabase
from app.services.audit import build_request_audit, create_request_id, persist_request_audit

logger = logging.getLogger("uvicorn.error")


def _cors_origins_from_env() -> list[str]:
    raw = (os.environ.get("CORS_ORIGINS") or "").strip()
    if not raw:
        # Keep permissive local default; set CORS_ORIGINS in production.
        return ["*"]
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or ["*"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Log which code file and /ai routes this process actually registered (debug stale servers)."""
    import app.routers.ai as ai_mod

    paths = sorted(
        r.path for r in app.routes if isinstance(r, APIRoute) and r.path.startswith("/ai/")
    )
    logger.info("SIGE /ai routes: %s", paths)
    logger.info("SIGE app.routers.ai file: %s", getattr(ai_mod, "__file__", "?"))
    yield


app = FastAPI(title="SIGE API", version="1.0.0", lifespan=lifespan)

# Local dev: allow any origin (browser fetch does not send cookies to this API by default).
# Tighten allow_origins in production behind a known frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins_from_env(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metrics.router)
app.include_router(project.router)
app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(geo.router)
app.include_router(messages.router)
app.include_router(supabase.router)
app.include_router(redis_health.router)


@app.middleware("http")
async def request_audit_middleware(request, call_next):
    request_id = create_request_id()
    started = time.perf_counter()
    status_code = 500
    response: Response | None = None
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = int((time.perf_counter() - started) * 1000)
        record = build_request_audit(
            request,
            request_id=request_id,
            status_code=status_code,
            duration_ms=duration_ms,
        )
        persist_request_audit(record)
        if response is not None:
            response.headers["X-Request-ID"] = request_id


@app.get("/health")
def health():
    key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
    paths = {r.path for r in app.routes if isinstance(r, APIRoute)}
    ai_paths = sorted(p for p in paths if p.startswith("/ai/"))
    return {
        "status": "ok",
        "gemini_api_key_loaded": bool(key),
        "ai_clean_floorplan_image": "/ai/clean-floorplan-image" in paths,
        "ai_routes": ai_paths,
        "supabase_health_path": "/supabase/health" in paths,
        "redis_health_path": "/redis/health" in paths,
        "request_audit_enabled": True,
    }
