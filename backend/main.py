"""
PrivateLens API v2
Bloomberg for Private Companies — PrivateScore™ financial health scoring engine
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers.score import router as score_router
from core.config import get_settings
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("privatelens")

settings = get_settings()

app = FastAPI(
    title="PrivateLens API",
    description="Bloomberg for Private Companies — PrivateScore™ financial health scoring",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Response-Time"] = f"{ms}ms"
    return response

# Global error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})

app.include_router(score_router)

@app.get("/")
def root():
    return {
        "product": "PrivateLens",
        "tagline": "Bloomberg for Private Companies",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "endpoints": ["/api/score", "/api/compare", "/api/history", "/api/signals"],
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}
