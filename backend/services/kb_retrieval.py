"""
KB retrieval — vector similarity search against ChromaDB.
Returns the single best-matching chunk, or None if nothing is relevant.
Citation guard: never return a result below the similarity threshold.
"""


def query_kb(
    message: str,
    org_id: str,
    embedding_model,
    chroma_client,
    similarity_threshold: float = 0.45,
) -> dict | None:
    """
    Search the org's ChromaDB collection for the most relevant chunk.
    Returns a dict with title, source_file, chunk_id, relevance_score, excerpt
    or None if no match passes the threshold.
    """
    collection = chroma_client.get_or_create_collection(f"org_{org_id}")

    # Check if collection has any documents
    if collection.count() == 0:
        return None

    query_embedding = embedding_model.encode(message).tolist()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=1,
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"][0]:
        return None

    distance = results["distances"][0][0]
    if distance > similarity_threshold:
        return None  # No match good enough — return nothing, never guess

    return {
        "title": results["metadatas"][0][0].get("title", "Document"),
        "source_file": results["metadatas"][0][0].get("filename", ""),
        "chunk_id": results["ids"][0][0],
        "relevance_score": round((1 - distance) * 100),
        "excerpt": results["documents"][0][0][:200],
    }
