"""
KB document ingestion — PDF and CSV parsing, chunking, and embedding.
Each document is split into chunks, embedded with sentence-transformers,
and stored in a ChromaDB collection scoped to the org.
"""

import csv
import io
import re
import uuid

from pypdf import PdfReader


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------
def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping chunks of approximately `chunk_size` characters.
    Tries to break at sentence boundaries when possible.
    """
    text = text.strip()
    if not text:
        return []

    # Split into sentences first
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: list[str] = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            # Keep overlap from end of previous chunk
            words = current_chunk.split()
            overlap_words = words[-overlap // 5:] if len(words) > overlap // 5 else []
            current_chunk = " ".join(overlap_words) + " " + sentence
        else:
            current_chunk += " " + sentence if current_chunk else sentence

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


# ---------------------------------------------------------------------------
# PDF ingestion
# ---------------------------------------------------------------------------
def ingest_pdf(
    file_bytes: bytes,
    filename: str,
    org_id: str,
    doc_id: str,
    embedding_model,
    chroma_client,
) -> int:
    """
    Parse a PDF file, chunk the text, embed each chunk, and store in ChromaDB.
    Returns the number of chunks created.
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    full_text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            full_text += page_text + "\n"

    if not full_text.strip():
        return 0

    chunks = _chunk_text(full_text)
    if not chunks:
        return 0

    collection = chroma_client.get_or_create_collection(f"org_{org_id}")

    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    embeddings = embedding_model.encode(chunks).tolist()
    metadatas = [
        {
            "filename": filename,
            "title": filename.rsplit(".", 1)[0],
            "doc_id": doc_id,
            "org_id": org_id,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)


# ---------------------------------------------------------------------------
# CSV ingestion
# ---------------------------------------------------------------------------
def ingest_csv(
    file_bytes: bytes,
    filename: str,
    org_id: str,
    doc_id: str,
    embedding_model,
    chroma_client,
) -> int:
    """
    Parse a CSV file. Each row is turned into a readable text chunk
    using its column headers as context, then embedded and stored.
    Returns the number of chunks created.
    """
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    rows_text: list[str] = []
    for row in reader:
        # Turn each row into a readable sentence: "Column: Value, Column: Value"
        parts = [f"{k}: {v}" for k, v in row.items() if v and v.strip()]
        if parts:
            rows_text.append(", ".join(parts))

    if not rows_text:
        return 0

    # Make each Q&A row its own distinct chunk for precise semantic search
    chunks = rows_text

    collection = chroma_client.get_or_create_collection(f"org_{org_id}")

    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    embeddings = embedding_model.encode(chunks).tolist()
    metadatas = [
        {
            "filename": filename,
            "title": filename.rsplit(".", 1)[0],
            "doc_id": doc_id,
            "org_id": org_id,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)
