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
) -> dict | None:
    """
    Search the org's ChromaDB collection for the most relevant chunk.
    Returns a dict with title, source_file, chunk_id, relevance_score, excerpt
    or None if no match passes the threshold.
    """
    collection_name = f"org_{org_id}"
    collection = chroma_client.get_or_create_collection(collection_name)

    doc_count = collection.count()
    logger.info(f"KB search: collection='{collection_name}' docs={doc_count} query='{message[:50]}'")

    # Check if collection has any documents
    if doc_count == 0:
        logger.warning(f"KB collection '{collection_name}' is EMPTY — no documents uploaded for this org.")
        return None

    query_embedding = embedding_model.encode(message).tolist()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=1,
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"][0]:
        logger.warning("KB query returned no results.")
        return None

    distance = results["distances"][0][0]
    # Convert L2 distance (0.0=perfect to ~1.5=weak) to a UI-friendly 70-99% score
    relevance = max(70, min(99, int(99 - (distance / 1.5) * 29)))
    logger.info(f"KB best match: distance={distance:.4f} relevance={relevance}% threshold={similarity_threshold}")

    if distance > similarity_threshold:
        logger.info(f"KB match rejected: distance {distance:.4f} > threshold {similarity_threshold}")
        return None  # No match good enough — return nothing, never guess

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

