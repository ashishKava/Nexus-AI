import pytest
from app.services.rag import RAGService
from app.schemas import DocumentIngestInput, RAGQueryInput
from fastapi.testclient import TestClient
from app.main import app
import os

client = TestClient(app)

def test_chunking_logic():
    service = RAGService()
    text = "This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five."
    # Chunk with very small size to test splitting
    chunks = service.chunk_text(text, chunk_size=8, overlap=0)
    assert len(chunks) >= 2
    for c in chunks:
        assert len(c.split()) <= 10

def test_rag_ingest_and_query():
    # Clean old rag_store.json if it exists by resetting store
    service = RAGService()
    service.store = {}
    
    workspace_id = "test-ws-rag"
    doc_id = "doc-123"
    doc_name = "server_docs.txt"
    text_content = (
        "Nexus AI is a modern AI platform built using Fastify and FastAPI. "
        "It supports real-time anomaly detection and event streaming analytics. "
        "The system calculates the Z-Score of events to find latency outliers."
    )
    
    # Ingest
    num_chunks = service.ingest_document(workspace_id, doc_id, doc_name, text_content)
    assert num_chunks > 0
    
    # Query with exact match keywords
    answer, sources = service.query_workspace(workspace_id, "What is Nexus AI platform built with?")
    assert len(sources) > 0
    assert sources[0]["documentId"] == doc_id
    assert sources[0]["documentName"] == doc_name
    assert "Fastify and FastAPI" in sources[0]["snippet"]
    assert "Nexus AI" in answer
    
    # Delete
    deleted = service.delete_document(workspace_id, doc_id)
    assert deleted is True
    
    # Query again (should be empty)
    answer_empty, sources_empty = service.query_workspace(workspace_id, "What is Nexus AI?")
    assert len(sources_empty) == 0

def test_rag_endpoints():
    payload_ingest = {
        "documentId": "endpoint-doc",
        "documentName": "install.md",
        "text": "To install the project dependencies, run pnpm install in the workspace root."
    }
    
    # Ingest API
    response = client.post("/rag/ingest?workspace_id=ws-endpoint", json=payload_ingest)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["chunksIndexed"] > 0
    
    # Query API
    payload_query = {
        "query": "How to install project dependencies?"
    }
    response_query = client.post("/rag/query?workspace_id=ws-endpoint", json=payload_query)
    assert response_query.status_code == 200
    data_query = response_query.json()
    assert "pnpm install" in data_query["answer"]
    assert len(data_query["sources"]) > 0
    
    # Delete API
    response_delete = client.delete("/rag/document?workspace_id=ws-endpoint&document_id=endpoint-doc")
    assert response_delete.status_code == 200
    assert response_delete.json()["success"] is True
