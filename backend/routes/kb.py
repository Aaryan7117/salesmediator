"""
Knowledge Base routes — upload, list, and delete documents.

POST /kb/upload         — upload PDF or CSV, validate, chunk, embed, store
GET  /kb/documents      — list all KB documents for the org
DELETE /kb/documents/{id} — delete a document and its chunks
"""

import re
import uuid

import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

logger = logging.getLogger(__name__)

from models.schemas import KBDocumentResponse
from supabase_client import get_supabase
from services.kb_ingest import ingest_pdf, ingest_csv

router = APIRouter()

# Allowed MIME types — validate server-side, not just by extension
ALLOWED_MIMES = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/vnd.ms-excel": "csv",  # some systems send CSV as this
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_user_from_token(token: str) -> dict:
    """
    Verify JWT and return user profile with org_id and role.
    Uses the service-role client to look up the user.
    """
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        logger.error(f"kb: token validation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(exc)}",
        )

    user_id = str(auth_response.user.id)
    logger.info(f"kb: token valid, user_id={user_id}")
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    logger.info(f"kb: profile lookup result: {profile.data}")
    if not profile.data:
        logger.error(f"kb: NO profile found for user_id={user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

    return {"user_id": user_id, **profile.data[0]}


def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token.")
    return auth_header.split(" ", 1)[1]


@router.post("/upload", response_model=KBDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(request: Request, file: UploadFile = File(...)):
    """
    Upload a PDF or CSV document:
    1. Validate MIME type and size
    2. Upload raw file to Supabase Storage
    3. Parse, chunk, embed → ChromaDB
    4. Insert metadata row in kb_documents
    """
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can upload documents.")

    # Validate MIME type
    content_type = file.content_type or ""
    file_type = ALLOWED_MIMES.get(content_type)
    if not file_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}. Only PDF and CSV are allowed.",
        )

    # Read and validate size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File exceeds 10MB limit.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty.",
        )

    org_id = user["org_id"]
    doc_id = str(uuid.uuid4())
    filename = re.sub(r"<[^>]*>", "", file.filename or "document")
    storage_path = f"{org_id}/{doc_id}/{filename}"

    sb = get_supabase()

    # Upload to Supabase Storage
    try:
        sb.storage.from_("kb-documents").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to storage: {str(exc)}",
        )

    # Chunk + embed + store in ChromaDB
    chroma_client = request.app.state.chroma_client
    embedding_model = request.app.state.embedding_model

    if chroma_client is None or embedding_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ChromaDB or embedding model not available. Install chromadb and sentence-transformers.",
        )

    if file_type == "pdf":
        chunk_count = ingest_pdf(file_bytes, filename, org_id, doc_id, embedding_model, chroma_client)
    else:
        chunk_count = ingest_csv(file_bytes, filename, org_id, doc_id, embedding_model, chroma_client)

    if chunk_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No text content could be extracted from the file.",
        )

    # Insert metadata row
    try:
        result = sb.table("kb_documents").insert({
            "id": doc_id,
            "org_id": org_id,
            "filename": filename,
            "file_type": file_type,
            "storage_path": storage_path,
            "chunk_count": chunk_count,
        }).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save document metadata: {str(exc)}",
        )

    row = result.data[0]
    return KBDocumentResponse(
        id=row["id"],
        filename=row["filename"],
        file_type=row["file_type"],
        chunk_count=row["chunk_count"],
        uploaded_at=row.get("uploaded_at"),
    )


@router.get("/documents", response_model=list[KBDocumentResponse])
async def list_documents(request: Request):
    """List all KB documents for the authenticated user's org."""
    token = _extract_token(request)
    user = _get_user_from_token(token)

    sb = get_supabase()
    result = (
        sb.table("kb_documents")
        .select("id, filename, file_type, chunk_count, uploaded_at")
        .eq("org_id", user["org_id"])
        .order("uploaded_at", desc=True)
        .execute()
    )

    return [KBDocumentResponse(**row) for row in result.data]


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, request: Request):
    """
    Delete a KB document:
    1. Remove from Supabase Storage
    2. Remove chunks from ChromaDB
    3. Delete metadata row
    """
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete documents.")

    sb = get_supabase()
    org_id = user["org_id"]

    # Fetch document to confirm ownership
    doc_result = (
        sb.table("kb_documents")
        .select("*")
        .eq("id", doc_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not doc_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    doc = doc_result.data[0]

    # Remove from Supabase Storage
    try:
        sb.storage.from_("kb-documents").remove([doc["storage_path"]])
    except Exception:
        pass  # Storage cleanup failure is non-critical

    # Remove chunks from ChromaDB
    chroma_client = request.app.state.chroma_client
    if chroma_client:
        try:
            collection = chroma_client.get_or_create_collection(f"org_{org_id}")
            # Get all chunk IDs for this document
            all_ids = collection.get(where={"doc_id": doc_id})["ids"]
            if all_ids:
                collection.delete(ids=all_ids)
        except Exception:
            pass  # ChromaDB cleanup failure is non-critical

    # Delete metadata row
    sb.table("kb_documents").delete().eq("id", doc_id).eq("org_id", org_id).execute()
