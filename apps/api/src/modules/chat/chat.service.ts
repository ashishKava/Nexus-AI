import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/errors.js";

export interface ChatResponse {
  response: string;
  actionExecuted?: {
    type: string;
    details: any;
  };
}

export class ChatService {
  private aiServiceUrl: string;

  constructor(private prisma: PrismaClient) {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
  }

  async processChatMessage(
    userId: string,
    orgId: string,
    workspaceId: string | undefined,
    message: string
  ): Promise<ChatResponse> {
    // 1. Fetch matching RAG contexts if workspaceId is provided
    let ragContexts: any[] = [];
    let contextPrompt = "";
    if (workspaceId) {
      try {
        const response = await fetch(`${this.aiServiceUrl}/rag/query?workspace_id=${workspaceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: message }),
        });
        if (response.ok) {
          const data = await response.json();
          ragContexts = data.sources || [];
          if (ragContexts.length > 0) {
            contextPrompt = "Use the following context retrieved from workspace documents to answer the query:\n" +
              ragContexts.map((src) => `[Source: ${src.documentName}]: ${src.snippet}`).join("\n") + "\n";
          }
        }
      } catch (err) {
        console.warn("RAG query failed or service offline. Proceeding without document context.");
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      // --- Online Gemini API Chat Flow ---
      return this.callGeminiAPI(orgId, workspaceId, message, contextPrompt, geminiKey);
    } else {
      // --- Zero-Config NLP Fallback Flow ---
      return this.executeFallbackRuleEngine(orgId, workspaceId, message, contextPrompt, ragContexts);
    }
  }

  private async callGeminiAPI(
    orgId: string,
    workspaceId: string | undefined,
    message: string,
    contextPrompt: string,
    apiKey: string
  ): Promise<ChatResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `You are the Nexus-AI Assistant.
Current Organization ID: ${orgId}
Current Workspace ID: ${workspaceId || "None"}
${contextPrompt}
You can take actions on behalf of the user by executing functions. Supported functions:
- createWorkspace(name, slug)
- listWorkspaces()
- getWorkspacePerformance()

Always respond in helpful markdown format. If the user asks to create a workspace, show performance stats, or list workspaces, trigger the corresponding function call.`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "createWorkspace",
              description: "Create a new workspace inside the organization.",
              parameters: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", description: "Name of the workspace, e.g. Engineering" },
                  slug: { type: "STRING", description: "Slug URL of the workspace, e.g. engineering" }
                },
                required: ["name", "slug"]
              }
            },
            {
              name: "listWorkspaces",
              description: "List all workspaces inside the current organization.",
              parameters: {
                type: "OBJECT",
                properties: {}
              }
            },
            {
              name: "getWorkspacePerformance",
              description: "Retrieve latency performance metrics and anomalies for the active workspace.",
              parameters: {
                type: "OBJECT",
                properties: {}
              }
            }
          ]
        }
      ]
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const firstCandidate = data.candidates?.[0];
      const part = firstCandidate?.content?.parts?.[0];

      // Check if the model wants to call a tool/function
      if (part?.functionCall) {
        const { name, args } = part.functionCall;
        return this.executeAgentTool(name, args, orgId, workspaceId);
      }

      // Standard text response
      const text = part?.text || "I'm sorry, I couldn't formulate a response.";
      return { response: text };
    } catch (err: any) {
      console.error("Gemini API call failed:", err);
      throw new AppError(502, "LLM Gateway Communication Error", `Gemini API execution failed: ${err.message}`);
    }
  }

  private async executeAgentTool(
    toolName: string,
    args: any,
    orgId: string,
    workspaceId: string | undefined
  ): Promise<ChatResponse> {
    switch (toolName) {
      case "createWorkspace": {
        const { name, slug } = args;
        if (!name || !slug) {
          return { response: "Failed to create workspace. Name and slug parameters are required." };
        }

        // Check if slug is unique
        const existing = await this.prisma.workspace.findUnique({
          where: {
            organizationId_slug: {
              organizationId: orgId,
              slug,
            },
          },
        });

        if (existing) {
          return { response: `I was unable to create the workspace because the slug '${slug}' is already in use within this organization.` };
        }

        const workspace = await this.prisma.workspace.create({
          data: {
            name,
            slug,
            organizationId: orgId,
          },
        });

        return {
          response: `✨ **Workspace Created Successfully!**\n\nI have created the new workspace **${workspace.name}** (slug: \`/${workspace.slug}\`) for you.`,
          actionExecuted: {
            type: "CREATE_WORKSPACE",
            details: workspace,
          },
        };
      }

      case "listWorkspaces": {
        const workspaces = await this.prisma.workspace.findMany({
          where: { organizationId: orgId },
          orderBy: { name: "asc" },
        });

        if (workspaces.length === 0) {
          return { response: "There are currently no workspaces configured in this organization." };
        }

        const mdList = workspaces.map((ws) => `- **${ws.name}** (slug: \`/${ws.slug}\`)`).join("\n");
        return {
          response: `Here are the workspaces in your current organization:\n\n${mdList}`,
          actionExecuted: {
            type: "LIST_WORKSPACES",
            details: workspaces,
          },
        };
      }

      case "getWorkspacePerformance": {
        if (!workspaceId) {
          return { response: "I cannot retrieve performance metrics because you are not currently viewing any workspace dashboard. Please enter a workspace first." };
        }

        const events = await this.prisma.workspaceEvent.findMany({
          where: { workspaceId },
        });

        if (events.length === 0) {
          return { response: "There is no latency event log currently registered in this workspace." };
        }

        // Calculate statistics locally
        const total = events.length;
        const sum = events.reduce((s, e) => s + e.durationMs, 0);
        const mean = round(sum / total, 2);
        
        // Median
        const sorted = [...events].sort((a, b) => a.durationMs - b.durationMs);
        const mid = Math.floor(total / 2);
        const median = round(total % 2 !== 0 ? sorted[mid].durationMs : (sorted[mid - 1].durationMs + sorted[mid].durationMs) / 2, 2);

        // Standard Deviation
        const variance = events.reduce((s, e) => s + Math.pow(e.durationMs - mean, 2), 0) / total;
        const stdDev = round(Math.sqrt(variance), 2);

        return {
          response: `📊 **Active Workspace Latency Analytics**\n\n*   **Total Logged Events**: ${total}\n*   **Average Latency (Mean)**: ${mean} ms\n*   **Median Latency**: ${median} ms\n*   **Standard Deviation**: ${stdDev} ms`,
          actionExecuted: {
            type: "WORKSPACE_PERFORMANCE",
            details: { total, mean, median, stdDev },
          },
        };
      }

      default:
        return { response: `I triggered function call '${toolName}' but it is not implemented in my action handler.` };
    }
  }

  private async executeFallbackRuleEngine(
    orgId: string,
    workspaceId: string | undefined,
    message: string,
    contextPrompt: string,
    ragContexts: any[]
  ): Promise<ChatResponse> {
    const msg = message.toLowerCase().trim();

    // 1. Tool Call: Create Workspace
    // Matches: "create workspace named x" or "create a workspace x" or "add the workspace x"
    const createMatch = message.match(/(?:create|add|make)\s+(?:a\s+|the\s+)?workspace\s+(?:named|called\s+)?([a-zA-Z0-9\s\-]+)/i);
    if (createMatch) {
      const name = createMatch[1].trim();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return this.executeAgentTool("createWorkspace", { name, slug }, orgId, workspaceId);
    }

    // 2. Tool Call: List Workspaces
    if (msg.includes("list workspace") || msg.includes("show workspace") || msg.includes("get workspaces")) {
      return this.executeAgentTool("listWorkspaces", {}, orgId, workspaceId);
    }

    // 3. Tool Call: Get Performance Metrics
    if (msg.includes("performance") || msg.includes("latency") || msg.includes("stats") || msg.includes("anomaly") || msg.includes("anomalies")) {
      return this.executeAgentTool("getWorkspacePerformance", {}, orgId, workspaceId);
    }

    // 4. RAG / Cognitive Search match fallback
    if (workspaceId && ragContexts.length > 0) {
      const bestMatch = ragContexts[0]["snippet"];
      const docName = ragContexts[0]["documentName"];
      
      let answer = `🤖 **Mock AI (RAG Context Answer):**\n\nBased on your workspace document **${docName}**:\n\n`;
      if (bestMatch.length > 250) {
        answer += `*"...${bestMatch.slice(0, 250)}..."*`;
      } else {
        answer += `*"${bestMatch}"*`;
      }
      return { response: answer };
    }

    // 5. General AI fallback response
    return {
      response: `🤖 **Mock AI Assistant** (Keyless Fallback):\n\nI received your message: "${message}".\n\nI can help you manage workspaces and view telemetry metrics. Try asking me:\n*   "Create workspace named Analytics Node"\n*   "Show workspaces list"\n*   "How is the latency performance?"`
    };
  }
}

function round(value: number, decimals: number): number {
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}
