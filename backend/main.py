"""
FastAPI application entry point.
Registers all routers, configures CORS, and manages application lifespan
(ChromaDB client + embedding model initialization).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import settings
from routes import auth, kb, chat, session, leads, team, integrations, analytics, widget_config, live

logger = logging.getLogger(__name__)

# Deferred imports — these C-extension packages may not be installed yet
# (ChromaDB requires MSVC build tools on Windows). They are only needed
# for KB ingestion (Phase 3) and chat (Phase 4).
try:
    import chromadb
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

try:
    from chromadb.utils import embedding_functions
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: initialise ChromaDB (persistent local storage) and
    the sentence-transformer embedding model once, attach to app.state.
    These are optional for Phase 2 — the server will start without them
    and log a warning. Phases 3+ require them.
    Shutdown: clean up resources.
    """
    if CHROMADB_AVAILABLE:
        app.state.chroma_client = chromadb.PersistentClient(path="./chroma_data")
        logger.info("ChromaDB initialised (persistent storage at ./chroma_data)")
    else:
        app.state.chroma_client = None
        logger.warning(
            "ChromaDB not installed — KB ingestion and chat will not work. "
            "Install with: pip install chromadb"
        )

    if EMBEDDINGS_AVAILABLE:
        app.state.embedding_model = embedding_functions.DefaultEmbeddingFunction()
        logger.info("Embedding model loaded (Chroma ONNX Default)")
    else:
        app.state.embedding_model = None
        logger.warning(
            "Embedding functions not available — KB ingestion and chat will not work."
        )

    yield
    # Shutdown — nothing to explicitly close for these resources


app = FastAPI(
    title="SalesGen API",
    description="AI Sales Consultant backend — multi-tenant, KB-powered chat with intent scoring.",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
origins = (
    [o.strip() for o in settings.cors_origins.split(",")]
    if settings.cors_origins != "*"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Validation error logging — shows exact 422 error details in console
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error on {request.method} {request.url.path}")
    for error in exc.errors():
        logger.error(f"  Field: {error.get('loc')} | Type: {error.get('type')} | Msg: {error.get('msg')}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(kb.router, prefix="/kb", tags=["Knowledge Base"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(session.router, prefix="/session", tags=["Session"])
app.include_router(leads.router, prefix="/leads", tags=["Leads"])
app.include_router(team.router, prefix="/team", tags=["Team"])
app.include_router(integrations.router, prefix="/integrations", tags=["Integrations"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(widget_config.router, prefix="/widget-config", tags=["Widget Config"])
app.include_router(live.router, prefix="/live", tags=["Live Streaming"])

# Serve widget.js as a static file
widget_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "widget")
if os.path.exists(widget_dir):
    app.mount("/widget", StaticFiles(directory=widget_dir), name="widget")


# ---------------------------------------------------------------------------
# Debug request logging (temporary)
# ---------------------------------------------------------------------------
@app.middleware("http")
async def debug_log_requests(request, call_next):
    auth_header = request.headers.get("Authorization", "")
    has_token = "YES" if auth_header.startswith("Bearer ") else "NO"
    logger.info(f">>> {request.method} {request.url.path} | Auth token: {has_token}")
    response = await call_next(request)
    logger.info(f"<<< {request.method} {request.url.path} | Status: {response.status_code}")
    return response


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}
