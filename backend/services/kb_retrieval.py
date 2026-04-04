"""
KB retrieval — vector similarity search against ChromaDB.
Returns the single best-matching chunk, or None if nothing is relevant.
Citation guard: never return a result below the similarity threshold.
"""

import logging

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
    Search the org's ChromaDB collection for the most relevant chunks.
    Returns a list of dicts with title, source_file, chunk_id, relevance_score, excerpt.
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
        return []

    results = collection.query(
        query_texts=[message],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"] or not results["ids"][0]:
        logger.warning("KB query returned no results.")
        return []

    matched_resources = []
    for i in range(len(results["ids"][0])):
        distance = results["distances"][0][i]
        relevance = max(70, min(99, int(99 - (distance / 1.5) * 29)))
        
        if distance > similarity_threshold:
            logger.info(f"KB match rejected: distance {distance:.4f} > threshold {similarity_threshold}")
            continue

        title = results["metadatas"][0][i].get("title", "Document")
        logger.info(f"KB match accepted: '{title}' at {relevance}% relevance")

        matched_resources.append({
            "title": title,
            "source_file": results["metadatas"][0][i].get("filename", ""),
            "chunk_id": results["ids"][0][i],
            "relevance_score": relevance,
            "content": results["documents"][0][i],
            "excerpt": results["documents"][0][i][:200],
        })

    return matched_resources

