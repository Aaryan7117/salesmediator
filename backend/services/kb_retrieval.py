"""
KB retrieval — vector similarity search against ChromaDB + structured resources.

V2: Now returns multiple results and can query structured kb_resources table
for product spec links and platform videos.
"""

import logging

logger = logging.getLogger(__name__)


def query_kb(
    message: str,
    org_id: str,
    embedding_model,
    chroma_client,
    similarity_threshold: float = 1.5,
    n_results: int = 3,
) -> dict | None:
    """
    Search the org's ChromaDB collection for the most relevant chunk.
    Returns a dict with title, source_file, chunk_id, relevance_score, excerpt, content
    or None if no match passes the threshold.
    """
    collection_name = f"org_{org_id}"
    collection = chroma_client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_model,
    )

    doc_count = collection.count()
    logger.info(f"KB search: collection='{collection_name}' docs={doc_count} query='{message[:50]}'")

    if doc_count == 0:
        logger.warning(f"KB collection '{collection_name}' is EMPTY — no documents uploaded for this org.")
        return None

    results = collection.query(
        query_texts=[message],
        n_results=min(n_results, doc_count),
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"][0]:
        logger.warning("KB query returned no results.")
        return None

    distance = results["distances"][0][0]
    relevance = max(70, min(99, int(99 - (distance / 1.5) * 29)))
    logger.info(f"KB best match: distance={distance:.4f} relevance={relevance}% threshold={similarity_threshold}")

    if distance > similarity_threshold:
        logger.info(f"KB match rejected: distance {distance:.4f} > threshold {similarity_threshold}")
        return None

    title = results["metadatas"][0][0].get("title", "Document")
    logger.info(f"KB match accepted: '{title}' at {relevance}% relevance")

    return {
        "title": title,
        "source_file": results["metadatas"][0][0].get("filename", ""),
        "chunk_id": results["ids"][0][0],
        "relevance_score": relevance,
        "content": results["documents"][0][0],
        "excerpt": results["documents"][0][0][:200],
    }


def query_kb_resources(org_id: str, supabase_client, limit: int = 5) -> list[dict]:
    """
    Query the structured kb_resources table for product spec links, videos, etc.
    Returns a list of resource dicts with title, url, type, description.
    Used when a lead is unqualified to serve helpful resources.
    """
    try:
        result = (
            supabase_client.table("kb_resources")
            .select("title, url, type, description")
            .eq("org_id", org_id)
            .limit(limit)
            .execute()
        )
        resources = result.data or []
        logger.info(f"KB resources found: {len(resources)} for org {org_id}")
        return resources
    except Exception as exc:
        logger.warning(f"KB resources query failed (non-fatal): {exc}")
        return []


def get_org_qualification_criteria(org_id: str, supabase_client) -> dict | None:
    """
    Fetch org-specific qualification criteria from Supabase.
    Returns dict with required_fields and conditions, or None for defaults.
    """
    try:
        result = (
            supabase_client.table("qualification_criteria")
            .select("required_fields, conditions")
            .eq("org_id", org_id)
            .limit(1)
            .execute()
        )
        if result.data:
            logger.info(f"Custom qualification criteria found for org {org_id}")
            return result.data[0]
        logger.info(f"No custom criteria for org {org_id}, using defaults")
        return None
    except Exception as exc:
        logger.warning(f"Qualification criteria query failed, using defaults: {exc}")
        return None
