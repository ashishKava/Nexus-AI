export interface WorkspaceEvent {
  id: string;
  eventType: string;
  durationMs: number;
  timestamp: string;
}

export interface AnomalyDetail {
  id?: string;
  eventType: string;
  durationMs: number;
  timestamp: string;
  zScore: number;
}

export interface AnalyticsReport {
  workspaceId: string;
  totalEvents: number;
  meanDurationMs: number;
  medianDurationMs: number;
  stdDevDurationMs: number;
  anomalies: AnomalyDetail[];
}

export interface Document {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RAGQueryRequest {
  query: string;
}

export interface RAGQueryResponse {
  answer: string;
  sources: {
    documentId: string;
    documentName: string;
    snippet: string;
    score: number;
  }[];
}

export interface DocumentIngestRequest {
  documentId: string;
  documentName: string;
  text: string;
}

export interface DocumentIngestResponse {
  success: boolean;
  chunksIndexed: number;
}
