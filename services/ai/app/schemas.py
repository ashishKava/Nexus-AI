# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class WorkspaceEvent(BaseModel):
    eventType: str = Field(..., description="Type of the event, e.g. document_created")
    durationMs: float = Field(..., description="Duration of the event in milliseconds")
    timestamp: datetime = Field(..., description="Timestamp when the event occurred")

class WorkspaceMetricsInput(BaseModel):
    workspaceId: str = Field(..., description="UUID of the workspace")
    events: List[WorkspaceEvent] = Field(..., description="List of events to analyze")

class AnomalyDetail(BaseModel):
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