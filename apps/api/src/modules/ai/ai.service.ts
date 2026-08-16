export class AIService {
  private aiServiceUrl: string;

  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
  }

  async getWorkspaceAnalytics(workspaceId: string, events: Array<{ eventType: string; durationMs: number; timestamp: string }>) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/analytics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          events,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`FastAPI AI engine returned status ${response.status}: ${errorBody}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`AI Service communication failure: ${error.message}`);
    }
  }
}
