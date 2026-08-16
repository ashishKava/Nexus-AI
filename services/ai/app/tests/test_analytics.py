import pytest
from datetime import datetime, timezone
from app.schemas import WorkspaceEvent, WorkspaceMetricsInput
from app.services.analytics import analyze_workspace_events
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "nexus-ai-engine"
    assert "timestamp" in data

def test_empty_events():
    report = analyze_workspace_events("test-workspace-id", [])
    assert report.workspaceId == "test-workspace-id"
    assert report.totalEvents == 0
    assert report.meanDurationMs == 0.0
    assert report.medianDurationMs == 0.0
    assert report.stdDevDurationMs == 0.0
    assert len(report.anomalies) == 0

def test_statistics_and_anomaly_detection():
    # Construct normal events with duration around 100ms
    events = [
        WorkspaceEvent(eventType="doc_edit", durationMs=100.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=105.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=95.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=102.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=98.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=101.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=103.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=97.0, timestamp=datetime.now(timezone.utc)),
        WorkspaceEvent(eventType="doc_edit", durationMs=99.0, timestamp=datetime.now(timezone.utc)),
        # One anomaly with duration 500ms (highly above standard deviation)
        WorkspaceEvent(eventType="doc_sync_heavy", durationMs=500.0, timestamp=datetime.now(timezone.utc))
    ]

    report = analyze_workspace_events("workspace-123", events)
    assert report.workspaceId == "workspace-123"
    assert report.totalEvents == 10
    assert report.meanDurationMs > 100.0
    # There should be exactly 1 anomaly (durationMs=500.0)
    assert len(report.anomalies) == 1
    assert report.anomalies[0].eventType == "doc_sync_heavy"
    assert report.anomalies[0].durationMs == 500.0
    assert report.anomalies[0].zScore > 2.0  # Z-score of outlier should be > 2.0

def test_analytics_api_endpoint():
    payload = {
        "workspaceId": "ws-999",
        "events": [
            {"eventType": "search", "durationMs": 50.0, "timestamp": "2026-08-16T12:00:00Z"},
            {"eventType": "search", "durationMs": 55.0, "timestamp": "2026-08-16T12:01:00Z"},
            {"eventType": "search", "durationMs": 48.0, "timestamp": "2026-08-16T12:02:00Z"},
            {"eventType": "search", "durationMs": 52.0, "timestamp": "2026-08-16T12:03:00Z"},
            {"eventType": "search", "durationMs": 51.0, "timestamp": "2026-08-16T12:04:00Z"},
            {"eventType": "search", "durationMs": 49.0, "timestamp": "2026-08-16T12:05:00Z"},
            {"eventType": "search", "durationMs": 53.0, "timestamp": "2026-08-16T12:06:00Z"},
            {"eventType": "search", "durationMs": 47.0, "timestamp": "2026-08-16T12:07:00Z"},
            {"eventType": "search", "durationMs": 50.0, "timestamp": "2026-08-16T12:08:00Z"},
            {"eventType": "heavy_query", "durationMs": 300.0, "timestamp": "2026-08-16T12:09:00Z"}
        ]
    }
    response = client.post("/analytics", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["workspaceId"] == "ws-999"
    assert data["totalEvents"] == 10
    assert len(data["anomalies"]) == 1
    assert data["anomalies"][0]["eventType"] == "heavy_query"
