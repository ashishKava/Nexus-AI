"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import { useAuth, API_URL } from "../context/AuthContext";

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  action?: {
    type: string;
    details: any;
  };
}

export default function AIChatDrawer() {
  const { user, token } = useAuth();
  const params = useParams() as { workspaceId?: string };
  const pathname = usePathname();

  // Drawer Toggle State
  const [isOpen, setIsOpen] = useState(false);

  // Messages State
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "👋 Hi! I am your **Nexus-AI Assistant**.\n\nI can help you search workspace documents, create new workspaces, or retrieve performance statistics. Try asking me:\n\n*   *\"Create a workspace named Client Node\"*\n*   *\"Show workspaces list\"*\n*   *\"What are the latency performance statistics?\"*",
      timestamp: new Date(),
    },
  ]);

  // Input states
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);

  // Active Context IDs
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Load contextual active Org ID and Workspace ID
  useEffect(() => {
    if (!token || !user) return;

    const loadContext = async () => {
      const workspaceId = params.workspaceId;
      setActiveWorkspaceId(workspaceId || null);

      if (workspaceId) {
        try {
          const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setActiveOrgId(data.organizationId);
          }
        } catch (err) {
          console.error("Failed to load workspace context for chatbot", err);
        }
      } else {
        // Fallback: load first user organization
        try {
          const res = await fetch(`${API_URL}/api/v1/organizations?userId=${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const orgs = await res.json();
            if (orgs.length > 0) {
              setActiveOrgId(orgs[0].id);
            }
          }
        } catch (err) {
          console.error("Failed to load organizations context for chatbot", err);
        }
      }
    };

    loadContext();
  }, [params.workspaceId, pathname, token, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !token || !activeOrgId) return;

    const userMessage = inputVal;
    setInputVal("");
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userMessage, timestamp: new Date() },
    ]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          organizationId: activeOrgId,
          workspaceId: activeWorkspaceId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to contact chatbot");
      }

      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.response,
          timestamp: new Date(),
          action: data.actionExecuted,
        },
      ]);

      // If a tool action was executed (e.g. workspace creation), dispatch event to refresh UI
      if (data.actionExecuted) {
        window.dispatchEvent(
          new CustomEvent("nexus_action_executed", {
            detail: data.actionExecuted,
          })
        );
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `❌ **Error**: ${err.message || "Something went wrong. Please try again."}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null; // Don't render chatbot if not logged in

  return (
    <>
      {/* Floating Chat Bubble Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center text-white cursor-pointer shadow-lg hover:scale-105 transition duration-200 z-50 ring-2 ring-indigo-500/30"
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat Drawer */}
      {isOpen && (
        <div className="fixed right-6 bottom-24 w-[380px] h-[520px] bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-sm font-bold text-white tracking-wide">Nexus AI Agent</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={`msg-${idx}`}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-zinc-800 text-zinc-150 border border-zinc-700/40 rounded-bl-none"
                  }`}
                >
                  <div
                    className="whitespace-pre-wrap font-sans"
                    dangerouslySetInnerHTML={{
                      // Convert bold markdown (**text**) to HTML manually for clean formatting
                      __html: msg.text
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/`(.*?)`/g, "<code class='bg-zinc-950 px-1 py-0.5 rounded text-[10px] text-indigo-400 font-mono'>$1</code>")
                    }}
                  />
                  {msg.action && (
                    <div className="mt-2 border-t border-zinc-700/60 pt-2 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                      <span>Tool Action:</span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-indigo-400 font-mono font-bold uppercase">
                        {msg.action.type.replace("_", " ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-zinc-400 border border-zinc-700/40 rounded-2xl rounded-bl-none p-3.5 max-w-[85%] flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[10px] font-medium tracking-wide">Executing Agent Command...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input Footer */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-zinc-950/40 flex gap-2">
            <input
              type="text"
              required
              disabled={loading || !activeOrgId}
              placeholder={activeOrgId ? "Ask AI Assistant..." : "Select organization first"}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !inputVal.trim() || !activeOrgId}
              className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition shadow disabled:opacity-40"
            >
              <svg className="h-4 w-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>

        </div>
      )}
    </>
  );
}
