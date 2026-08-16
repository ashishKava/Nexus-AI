from fastapi import FastAPI, HTTPException
from app.schemas import WorkspaceMetricsInput, AnalyticsReport
from app.services.analytics import analyze_workspace_events
import time

app = FastAPI(
    title="Nexus AI Engine",
    description="Python FastAPI service for advanced analytics, ML calculations, and RAG pipelines.",
    version="1.0.0"
)

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
