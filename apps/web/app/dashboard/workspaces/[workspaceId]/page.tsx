"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, API_URL } from "../../../context/AuthContext";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Document, RAGQueryResponse, WorkspaceEvent, AnalyticsReport } from "@nexus/types";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function WorkspaceDashboard() {
  const { token, logout } = useAuth();
  const { workspaceId } = useParams() as { workspaceId: string };
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState<"analytics" | "knowledge">("analytics");

  // Data states
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Loading/Error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form/Simulation states
  const [simEventType, setSimEventType] = useState<"document_edit" | "api_request" | "model_inference" | "user_login">("api_request");
  const [simDurationMs, setSimDurationMs] = useState<number>(150);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState<string | null>(null);

  // RAG / Knowledge Base states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResult, setRagResult] = useState<RAGQueryResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

  // Fetch Workspace Meta, Analytics, and Documents
  const fetchData = async () => {
    if (!token || !workspaceId) return;

    try {
      // 1. Fetch workspace details
      const wsRes = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!wsRes.ok) {
        if (wsRes.status === 401 || wsRes.status === 403) {
          throw new Error("Access forbidden: you do not have permission to view this workspace.");
        }
        throw new Error("Failed to fetch workspace metadata.");
      }
      const wsData = await wsRes.json();
      setWorkspace(wsData);

      // 2. Fetch events & analytics report combined
      const analyticsRes = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!analyticsRes.ok) {
        throw new Error("Failed to fetch workspace analytics and events.");
      }
      const analyticsData = await analyticsRes.json();
      setEvents(analyticsData.events || []);
      setReport(analyticsData.report || null);

      // 3. Fetch documents
      const docsRes = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while loading data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [token, workspaceId]);

  // Handle Event Simulation Submit
  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !workspaceId) return;

    setIsSimulating(true);
    setSimSuccessMsg(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType: simEventType,
          durationMs: Number(simDurationMs),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit simulated event.");
      }

      setSimSuccessMsg(`Successfully registered simulated event (${simDurationMs}ms)! Recalculating...`);
      
      // Auto close message after 3 seconds
      setTimeout(() => setSimSuccessMsg(null), 3000);

      // Re-fetch analytics immediately to show the new event on chart & check for Z-score update
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to trigger event simulation.");
    } finally {
      setIsSimulating(false);
    }
  };

  // Handle Document Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !workspaceId) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to upload document");
      }

      const newDoc = await res.json();
      setDocuments((prev) => [newDoc, ...prev]);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  // Handle Document Delete
  const handleDeleteDocument = async (docId: string) => {
    if (!token || !workspaceId) return;
    
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/documents/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete document");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setRagResult(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete file");
    }
  };

  // Handle RAG QA search submit
  const handleRagSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !workspaceId || !ragQuery.trim()) return;

    setRagLoading(true);
    setRagError(null);
    setRagResult(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/documents/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: ragQuery }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "RAG query failed");
      }

      const result = await res.json();
      setRagResult(result);
    } catch (err: any) {
      setRagError(err.message || "Failed to query RAG knowledge base");
    } finally {
      setRagLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-zinc-400">Instantiating Nexus AI Engine...</span>
        </div>
      </div>
    );
  }

  // Prep Chart Data
  // Recharts XAxis works best with numerical values. We map timestamps to unix timestamps.
  const chartData = events.map((e) => {
    const isAnomaly = report?.anomalies.some((a) => a.id === e.id) || false;
    const anomalyDetail = report?.anomalies.find((a) => a.id === e.id);
    return {
      id: e.id,
      x: new Date(e.timestamp).getTime(),
      y: e.durationMs,
      eventType: e.eventType,
      isAnomaly,
      zScore: anomalyDetail ? anomalyDetail.zScore : 0,
      timestamp: e.timestamp,
    };
  });

  const formatXAxis = (tickItem: number) => {
    const d = new Date(tickItem);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-xl max-w-xs text-sm font-sans backdrop-blur-md bg-zinc-900/90">
          <div className="flex items-center gap-2 mb-2">
            <span className={`h-2.5 w-2.5 rounded-full ${data.isAnomaly ? "bg-red-500 animate-pulse" : "bg-indigo-500"}`} />
            <p className="font-bold text-white uppercase text-xs tracking-wider">{data.eventType.replace("_", " ")}</p>
          </div>
          <p className="text-zinc-300">
            Latency: <span className="font-semibold text-white">{data.y} ms</span>
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            Time: {new Date(data.timestamp).toLocaleString()}
          </p>
          {data.isAnomaly && (
            <div className="mt-2.5 border-t border-red-500/20 pt-2 text-red-400 text-xs flex justify-between">
              <span>Z-Score:</span>
              <span className="font-bold">{data.zScore.toFixed(2)}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-80 border-r border-zinc-800/80 bg-zinc-900/40 p-6 flex flex-col justify-between">
        <div>
          {/* Brand Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 mb-8 hover:opacity-90 transition">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              N
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Nexus AI
            </span>
          </Link>

          {/* Active Navigation */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Navigation
              </h3>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard Overview
                  </Link>
                </li>
                <li>
                  <div
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700/60"
                  >
                    <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    AI Analytics
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* User logout */}
        <div className="border-t border-zinc-800/60 pt-6 flex items-center justify-between">
          <div className="overflow-hidden">
            <span className="text-xs text-zinc-500">Parent Organization</span>
            <p className="text-sm font-semibold text-zinc-200 truncate">{workspace?.organization?.name || "Nexus AI"}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs font-semibold text-red-400 hover:text-red-300 transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-10 flex flex-col space-y-8 overflow-y-auto">
        
        {/* Breadcrumb & Header */}
        <div className="flex justify-between items-center border-b border-zinc-800/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
              <Link href="/dashboard" className="hover:text-zinc-300 transition">Dashboard</Link>
              <span>/</span>
              <span>Workspaces</span>
              <span>/</span>
              <span className="text-zinc-400">{workspace?.name}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">{workspace?.name}</h1>
            <p className="text-zinc-500 text-sm">Real-time Anomaly Detection & Service Latency</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 shadow-sm animate-pulse">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-850 gap-4 mb-6">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`pb-3 text-sm font-semibold border-b-2 transition duration-200 ${
              activeTab === "analytics"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Performance Analytics
          </button>
          <button
            onClick={() => setActiveTab("knowledge")}
            className={`pb-3 text-sm font-semibold border-b-2 transition duration-200 ${
              activeTab === "knowledge"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Knowledge Base (RAG)
          </button>
        </div>

        {activeTab === "analytics" ? (
          <>
            {/* Analytics Statistics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Total Events</span>
                <span className="text-3xl font-black text-white mt-2 block">{report?.totalEvents || 0}</span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-purple-500/5 rounded-full blur-2xl"></div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Mean Latency</span>
                <span className="text-3xl font-black text-white mt-2 block">
                  {report?.meanDurationMs ? `${report.meanDurationMs} ms` : "0 ms"}
                </span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-fuchsia-500/5 rounded-full blur-2xl"></div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Median Latency</span>
                <span className="text-3xl font-black text-white mt-2 block">
                  {report?.medianDurationMs ? `${report.medianDurationMs} ms` : "0 ms"}
                </span>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-pink-500/5 rounded-full blur-2xl"></div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Std Deviation</span>
                <span className="text-3xl font-black text-white mt-2 block">
                  {report?.stdDevDurationMs ? `${report.stdDevDurationMs} ms` : "0 ms"}
                </span>
              </div>

            </div>

            {/* Dashboard Grid (Chart + Simulation Panel) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Main Analytics Chart */}
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-lg flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-white text-lg">Latency Distribution Timeline</h3>
                    <p className="text-zinc-500 text-xs">Calculated Z-score limits shown live. Click trigger simulator to check updates.</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      <span className="text-zinc-400">Normal</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-zinc-400">Anomaly (|Z| &gt; 2.0)</span>
                    </div>
                  </div>
                </div>

                {/* Recharts Scatter Plot */}
                <div className="h-96 w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                        <defs>
                          <filter id="red-glow" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="Time"
                          domain={["auto", "auto"]}
                          tickFormatter={formatXAxis}
                          stroke="#71717a"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name="Latency"
                          unit="ms"
                          stroke="#71717a"
                          fontSize={11}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Scatter name="Events" data={chartData}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.isAnomaly ? "#ef4444" : "#6366f1"}
                              filter={entry.isAnomaly ? "url(#red-glow)" : undefined}
                              r={entry.isAnomaly ? 7 : 5}
                              className="cursor-pointer"
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-zinc-800 rounded-xl">
                      <p className="text-zinc-500 text-sm">No event data currently logged in this workspace</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Simulation Panel */}
              <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">Simulation Console</h3>
                    <p className="text-zinc-500 text-xs mt-1">
                      Inject synthetic events into the pipeline to trigger real-time AI calculations.
                    </p>
                  </div>

                  {simSuccessMsg && (
                    <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-400 shadow-sm">
                      {simSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleSimulateSubmit} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">
                        Event Type Profile
                      </label>
                      <select
                        value={simEventType}
                        onChange={(e) => setSimEventType(e.target.value as any)}
                        className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/40 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="user_login">User Login (user_login)</option>
                        <option value="document_edit">Document Edit (document_edit)</option>
                        <option value="api_request">API Gateway Request (api_request)</option>
                        <option value="model_inference">Model Inference (model_inference)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-zinc-400 mb-2">
                        <span>Simulated Latency</span>
                        <span className="text-indigo-400">{simDurationMs} ms</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="3000"
                        value={simDurationMs}
                        onChange={(e) => setSimDurationMs(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5">
                        <span>Normal Range (80 - 250ms)</span>
                        <span>Anomalous Range (&gt;1500ms)</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/40 border border-zinc-800/60 p-3.5 rounded-xl text-xs text-zinc-400 space-y-1.5">
                      <p className="font-bold text-zinc-300">How anomaly is detected:</p>
                      <p>
                        FastAPI computes the workspace standard deviation and average. 
                        Any event exceeding an absolute Z-score of 2.0 triggers a neural warning.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSimulating}
                      className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition duration-150 shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSimulating ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Deploying...
                        </>
                      ) : (
                        "Inundate API Gateway"
                      )}
                    </button>
                  </form>
                </div>
              </div>

            </div>

            {/* Anomaly Log Feed */}
            <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-lg flex flex-col space-y-4">
              <div>
                <h3 className="font-bold text-white text-lg">Detected Outliers & Anomaly log</h3>
                <p className="text-zinc-500 text-xs">Audit log of system events that triggered statistical deviation alerts.</p>
              </div>

              <div className="overflow-x-auto">
                {report?.anomalies && report.anomalies.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {report.anomalies.slice().reverse().map((anomaly, index) => (
                      <div
                        key={`anomaly-${index}`}
                        className="flex justify-between items-center p-4 bg-red-950/15 border border-red-500/25 rounded-xl text-sm shadow-sm relative overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 h-full w-[3px] bg-red-500" />
                        <div className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center font-bold text-red-500">
                            ⚠
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white uppercase text-xs tracking-wider">
                                {anomaly.eventType.replace("_", " ")}
                              </p>
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[10px]">
                                Z: {anomaly.zScore.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-zinc-500 text-xs mt-1">
                              Occurred on {new Date(anomaly.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-400">{anomaly.durationMs} ms</p>
                          <span className="text-[10px] text-zinc-500">Latency spike</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                    <p className="text-zinc-500 text-sm">No statistical anomalies detected. Everything runs smoothly.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Document inventory */}
            <div className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-lg flex flex-col space-y-6">
              <div>
                <h3 className="font-bold text-white text-lg">Document Inventory</h3>
                <p className="text-zinc-500 text-xs mt-1">Upload and manage workspace documents to feed the RAG Pipeline.</p>
              </div>

              {/* Upload Dropzone */}
              <div>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-zinc-700/80 rounded-xl cursor-pointer p-6 bg-zinc-950/20 hover:bg-zinc-900/50 transition duration-250 relative overflow-hidden group">
                  <div className="text-center space-y-2">
                    <svg className="mx-auto h-8 w-8 text-zinc-650 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-300 transition">
                      {uploading ? "Indexing file content..." : "Click to upload doc (.txt, .md)"}
                    </div>
                    <p className="text-[10px] text-zinc-600">Text-based files only up to 10MB</p>
                  </div>
                  <input
                    type="file"
                    accept=".txt,.md,.json,.csv,.html"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
                {uploadError && (
                  <p className="text-red-400 text-xs mt-2 bg-red-955/20 border border-red-500/10 p-2 rounded-lg">{uploadError}</p>
                )}
              </div>

              {/* Document Inventory Inventory List */}
              <div className="flex-1 overflow-y-auto max-h-[350px] space-y-2 pr-1">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center p-3.5 bg-zinc-950/40 border border-zinc-800/80 rounded-xl text-xs hover:border-zinc-700 transition">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="h-6 w-6 rounded bg-zinc-850 text-zinc-400 flex items-center justify-center font-bold text-[10px] uppercase">
                        {doc.name.split('.').pop() || "TXT"}
                      </span>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-zinc-200 truncate">{doc.name}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5">Added: {new Date(doc.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-zinc-550 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition"
                      title="Delete document"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                {documents.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                    <p className="text-zinc-600 text-xs italic">No documents in knowledge base</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: RAG Chat Console / Query drawer */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl shadow-lg flex flex-col space-y-6 min-h-[500px]">
              <div>
                <h3 className="font-bold text-white text-lg">RAG Cognitive Search</h3>
                <p className="text-zinc-500 text-xs mt-1">Ask questions of your document indexes. The AI will retrieve matching contexts and synthesize answers.</p>
              </div>

              {/* Chat Input Console */}
              <form onSubmit={handleRagSearchSubmit} className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="Ask a question about uploaded documents..."
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  className="flex-1 rounded-xl bg-zinc-950/60 border border-zinc-800 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={ragLoading}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {ragLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Searching...
                    </>
                  ) : (
                    "Query Index"
                  )}
                </button>
              </form>

              {ragError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 shadow-sm animate-pulse">
                  {ragError}
                </div>
              )}

              {/* Chat Output/Results */}
              <div className="flex-1 border border-zinc-850 rounded-xl bg-zinc-955/20 p-5 space-y-4 overflow-y-auto max-h-[300px]">
                {ragResult ? (
                  <div className="space-y-4 font-sans text-sm">
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {ragResult.answer}
                    </div>

                    {/* Citations Drawer */}
                    {ragResult.sources && ragResult.sources.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Retrieved References ({ragResult.sources.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ragResult.sources.map((source, sIdx) => (
                            <div key={`source-${sIdx}`} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2 text-xs flex flex-col justify-between">
                              <p className="text-zinc-400 italic">"...{source.snippet}..."</p>
                              <div className="flex justify-between items-center text-[10px] text-zinc-550 border-t border-zinc-800/80 pt-2">
                                <span className="font-semibold text-indigo-400">{source.documentName}</span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-500">Relevance: {(source.score * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center">
                    <p className="text-zinc-650 text-sm italic">
                      Ask a query above to retrieve and synthesize document records in real-time.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

    </div>
  );
}

