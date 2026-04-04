"""
KB retrieval — vector similarity search against ChromaDB + structured Supabase tables.
"""

import logging
from supabase_client import get_supabase

logger = logging.getLogger(__name__)

def query_kb(
    message: str,
    org_id: str,
    embedding_model,
    chroma_client,
    similarity_threshold: float = 1.5,
    n_results: int = 1,
) -> list[dict]:
    """
    Search the org's ChromaDB collection for unstructured chunks.
    """
    collection_name = f"org_{org_id}"
    collection = chroma_client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_model,
    )

    doc_count = collection.count()

    if doc_count == 0:
        return []

    results = collection.query(
        query_texts=[message],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"] or not results["ids"][0]:
        return []

    matched_resources = []
    for i in range(len(results["ids"][0])):
        distance = results["distances"][0][i]
        relevance = max(70, min(99, int(99 - (distance / 1.5) * 29)))
        
        if distance > similarity_threshold:
            continue

        title = results["metadatas"][0][i].get("title", "Document")

        matched_resources.append({
            "title": title,
            "source_file": results["metadatas"][0][i].get("filename", ""),
            "chunk_id": results["ids"][0][i],
            "relevance_score": relevance,
            "content": results["documents"][0][i],
            "excerpt": results["documents"][0][i][:200],
        })

    return matched_resources

def query_kb_resources(org_id: str, count: int = 3) -> list[dict]:
    """
    Query structured KB resources specifically tailored for unqualified leads.
    """
    sb = get_supabase()
    result = sb.table("kb_resources").select("*").eq("org_id", org_id).limit(count).execute()
    return result.data if result.data else []
