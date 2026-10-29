from fastapi import FastAPI, HTTPException
from app.schemas import (
    WorkspaceMetricsInput, AnalyticsReport, 
    DocumentIngestInput, DocumentIngestResponse, 
    RAGQueryInput, RAGQueryResponse
)
from app.services.analytics import analyze_workspace_events
from app.services.rag import RAGService
import time

app = FastAPI(
    title="Nexus AI Engine",
    description="Python FastAPI service for advanced analytics, ML calculations, and RAG pipelines.",
    version="1.0.0"
)

rag_service = RAGService()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "nexus-ai-engine",
        "timestamp": time.time()
    }

@app.post("/analytics", response_model=AnalyticsReport)
async def process_analytics(payload: WorkspaceMetricsInput):
    try:
        report = analyze_workspace_events(payload.workspaceId, payload.events)
        return report
    except Exception as e:
        # Structured error logging
        print(f"Error processing workspace analytics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal statistical calculation error: {str(e)}"
        )

@app.post("/rag/ingest", response_model=DocumentIngestResponse)
async def rag_ingest(workspace_id: str, payload: DocumentIngestInput):
    try:
        num_chunks = rag_service.ingest_document(
            workspace_id=workspace_id,
            document_id=payload.documentId,
            document_name=payload.documentName,
            text=payload.text
        )
        return DocumentIngestResponse(success=True, chunksIndexed=num_chunks)
    except Exception as e:
        print(f"Error ingesting document in RAG service: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to index document: {str(e)}"
        )

@app.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(workspace_id: str, payload: RAGQueryInput):
    try:
        answer, sources = rag_service.query_workspace(
            workspace_id=workspace_id,
            query=payload.query
        )
        return RAGQueryResponse(answer=answer, sources=sources)
    except Exception as e:
        print(f"Error executing RAG query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"RAG matching execution failed: {str(e)}"
        )

@app.delete("/rag/document")
async def rag_delete_document(workspace_id: str, document_id: str):
    try:
        deleted = rag_service.delete_document(workspace_id, document_id)
        return {"success": deleted}
    except Exception as e:
        print(f"Error deleting document from RAG index: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear document vectors: {str(e)}"
        )

