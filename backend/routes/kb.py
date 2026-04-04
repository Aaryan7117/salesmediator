"""
Knowledge Base routes — upload, list, and delete documents PLUS structured resources.
"""

import re
import uuid
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from models.schemas import KBDocumentResponse, KBResource
from supabase_client import get_supabase
from services.kb_ingest import ingest_pdf, ingest_csv

router = APIRouter()

ALLOWED_MIMES = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/vnd.ms-excel": "csv",
}

MAX_FILE_SIZE = 10 * 1024 * 1024

class KBResourceResponse(KBResource):
    id: str

def _get_user_from_token(token: str) -> dict:
    sb = get_supabase()
    try:
        auth_response = sb.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}")

    user_id = str(auth_response.user.id)
    profile = sb.table("users").select("org_id, role").eq("id", user_id).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found.")

    return {"user_id": user_id, **profile.data[0]}

def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token.")
    return auth_header.split(" ", 1)[1]


@router.post("/upload", response_model=KBDocumentResponse, status_code=201)
async def upload_document(request: Request, file: UploadFile = File(...)):
    token = _extract_token(request)
    user = _get_user_from_token(token)

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")

    content_type = file.content_type or ""
    file_type = ALLOWED_MIMES.get(content_type)
    if not file_type:
        raise HTTPException(status_code=400, detail="Only PDF and CSV allowed.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE or len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Invalid size.")

    org_id = user["org_id"]
    doc_id = str(uuid.uuid4())
    filename = re.sub(r"<[^>]*>", "", file.filename or "document")
    storage_path = f"{org_id}/{doc_id}/{filename}"
    sb = get_supabase()

    try:
        sb.storage.from_("kb-documents").upload(
            path=storage_path, file=file_bytes, file_options={"content-type": content_type}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    chroma_client = request.app.state.chroma_client
    embedding_model = request.app.state.embedding_model

    if file_type == "pdf":
        chunk_count = ingest_pdf(file_bytes, filename, org_id, doc_id, embedding_model, chroma_client)
    else:
        chunk_count = ingest_csv(file_bytes, filename, org_id, doc_id, embedding_model, chroma_client)

    result = sb.table("kb_documents").insert({
        "id": doc_id, "org_id": org_id, "filename": filename,
        "file_type": file_type, "storage_path": storage_path, "chunk_count": chunk_count,
    }).execute()

    row = result.data[0]
    return KBDocumentResponse(
        id=row["id"], filename=row["filename"], file_type=row["file_type"],
        chunk_count=row["chunk_count"], uploaded_at=row.get("uploaded_at")
    )


@router.get("/documents", response_model=list[KBDocumentResponse])
async def list_documents(request: Request):
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()
    res = sb.table("kb_documents").select("id, filename, file_type, chunk_count, uploaded_at").eq("org_id", user["org_id"]).order("uploaded_at", desc=True).execute()
    return [KBDocumentResponse(**row) for row in res.data]


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str, request: Request):
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()
    org_id = user["org_id"]

    doc_result = sb.table("kb_documents").select("*").eq("id", doc_id).eq("org_id", org_id).execute()
    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Not found.")

    doc = doc_result.data[0]
    try:
        sb.storage.from_("kb-documents").remove([doc["storage_path"]])
    except: pass

    chroma_client = request.app.state.chroma_client
    if chroma_client:
        try:
            collection = chroma_client.get_or_create_collection(f"org_{org_id}")
            all_ids = collection.get(where={"doc_id": doc_id})["ids"]
            if all_ids: collection.delete(ids=all_ids)
        except: pass

    sb.table("kb_documents").delete().eq("id", doc_id).eq("org_id", org_id).execute()


# --- STRUCTURED KB RESOURCES ---

@router.get("/resources", response_model=list[KBResourceResponse])
async def list_resources(request: Request):
    token = _extract_token(request)
    user = _get_user_from_token(token)
    sb = get_supabase()
    res = sb.table("kb_resources").select("*").eq("org_id", user["org_id"]).order("created_at", desc=True).execute()
    return [KBResourceResponse(**row) for row in res.data]

@router.post("/resources", response_model=KBResourceResponse, status_code=201)
async def create_resource(request: Request, body: KBResource):
    token = _extract_token(request)
    user = _get_user_from_token(token)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")

    sb = get_supabase()
    data = {
        "org_id": user["org_id"],
        "title": body.title,
        "url": body.url,
        "type": body.type,
        "description": body.description
    }
    res = sb.table("kb_resources").insert(data).execute()
    return KBResourceResponse(**res.data[0])

@router.delete("/resources/{resource_id}", status_code=204)
async def delete_resource(resource_id: str, request: Request):
    token = _extract_token(request)
    user = _get_user_from_token(token)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only.")
    
    sb = get_supabase()
    res = sb.table("kb_resources").delete().eq("id", resource_id).eq("org_id", user["org_id"]).execute()
    if not res.data:
        pass # just return 204
