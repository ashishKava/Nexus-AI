# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class WorkspaceEvent(BaseModel):
    id: Optional[str] = Field(None, description="Optional UUID of the event")
    eventType: str = Field(..., description="Type of the event, e.g. document_created")
    durationMs: float = Field(..., description="Duration of the event in milliseconds")
    timestamp: datetime = Field(..., description="Timestamp when the event occurred")

class WorkspaceMetricsInput(BaseModel):
    workspaceId: str = Field(..., description="UUID of the workspace")
    events: List[WorkspaceEvent] = Field(..., description="List of events to analyze")

class AnomalyDetail(BaseModel):
    id: Optional[str] = Field(None, description="Optional UUID of the event")
    eventType: str
    durationMs: float
    timestamp: datetime
    zScore: float

class AnalyticsReport(BaseModel):
    workspaceId: str
    totalEvents: int
    meanDurationMs: float
    medianDurationMs: float
    stdDevDurationMs: float
    anomalies: List[AnomalyDetail]

class DocumentIngestInput(BaseModel):
    documentId: str
    documentName: str
    text: str

class DocumentIngestResponse(BaseModel):
    success: bool
    chunksIndexed: int

class RAGQueryInput(BaseModel):
    query: str

class QuerySource(BaseModel):
    documentId: str
    documentName: str
    snippet: str
    score: float

class RAGQueryResponse(BaseModel):
    answer: str
    sources: List[QuerySource]