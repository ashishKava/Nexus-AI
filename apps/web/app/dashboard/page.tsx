"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, API_URL } from "../context/AuthContext";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export default function DashboardPage() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Organizations State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  
  // Workspaces State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState("");

  // UI status states
  const [error, setError] = useState<string | null>(null);
  const [orgCreating, setOrgCreating] = useState(false);
  const [workspaceCreating, setWorkspaceCreating] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login");
    }
  }, [token, authLoading, router]);

  // Load user's organizations
  // Note: Since we don't have a direct "list user's organizations" endpoint yet,
  // we will provide a way to load orgs, or just load them if the user creates them,
  // or retrieve them. Wait! In Phase 1 foundation we created:
  // `GET /api/v1/organizations/:id` which retrieves one org.
  // Wait! Do we have a list organizations endpoint? No, in Phase 1 we only created `POST /organizations` and `GET /organizations/:id`.
  // To make this fully functional, we can load organizations from a mock seed or local list, or we can add a quick `GET /organizations` listing endpoint to our API!
  // Wait! Adding a list organizations endpoint is extremely simple and is standard for the organization module!
  // Let's check: in `organizations.routes.ts` did we list organizations? No.
  // Let's add a `GET /api/v1/organizations` endpoint to list all organizations the user belongs to!
  // That would be extremely useful and makes the dashboard works perfectly!
  // Wait, let's look at how we can implement this:
  // In `OrganizationRepository`:
  // ```typescript
  // async findByUser(userId: string) {
  //   return this.prisma.organization.findMany({
  //     where: {
  //       members: { some: { userId } }
  //     }
  //   });
  // }
  // ```
  // This is a beautiful relational query! It queries all organizations where the user is a member!
  // Let's add this to our backend! It makes the dashboard completely dynamic and production-grade.

  // Let's write the dashboard code to call these API endpoints.
  useEffect(() => {
    if (!token || !user) return;

    const fetchOrganizations = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/organizations?userId=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setOrganizations(data);
          if (data.length > 0 && !selectedOrg) {
            setSelectedOrg(data[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch organizations", err);
      }
    };

    fetchOrganizations();
  }, [token, user]);

  // Load workspaces when organization selection changes
  useEffect(() => {
    if (!token || !selectedOrg) {
      setWorkspaces([]);
      return;
    }

    const fetchWorkspaces = async () => {
      setLoadingWorkspaces(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/organizations/${selectedOrg.id}/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setWorkspaces(data);
        }
      } catch (err) {
        console.error("Failed to fetch workspaces", err);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [selectedOrg, token]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) return;

    setOrgCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug,
          userId: user.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create organization");
      }

      setOrganizations((prev) => [...prev, data]);
      setSelectedOrg(data);
      setNewOrgName("");
      setNewOrgSlug("");
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setOrgCreating(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !token) return;

    setWorkspaceCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/organizations/${selectedOrg.id}/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newWorkspaceName,
          slug: newWorkspaceSlug,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create workspace");
      }

      setWorkspaces((prev) => [...prev, data]);
      setNewWorkspaceName("");
      setNewWorkspaceSlug("");
    } catch (err: any) {
      setError(err.message || "Failed to create workspace");
    } finally {
      setWorkspaceCreating(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar - Organization selector */}
      <aside className="w-80 border-r border-zinc-800/80 bg-zinc-900/40 p-6 flex flex-col justify-between">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              N
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Nexus AI
            </span>
          </div>

          {/* Org List */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Organizations
              </h3>
              <ul className="space-y-1">
                {organizations.map((org) => (
                  <li key={org.id}>
                    <button
                      onClick={() => setSelectedOrg(org)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-150 ${
                        selectedOrg?.id === org.id
                          ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700/60"
                          : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                      }`}
                    >
                      {org.name}
                    </button>
                  </li>
                ))}
                {organizations.length === 0 && (
                  <p className="text-sm text-zinc-600 italic px-3">No organizations found</p>
                )}
              </ul>
            </div>

            {/* Create Org Form */}
            <div className="border-t border-zinc-800/60 pt-6">
              <h4 className="text-xs font-semibold text-zinc-400 mb-3">
                New Organization
              </h4>
              <form onSubmit={handleCreateOrg} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Org Name (e.g. Acme)"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                  }}
                  className="w-full rounded-lg bg-zinc-800/40 border border-zinc-700/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
                />
                <input
                  type="text"
                  required
                  placeholder="org-slug"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800/40 border border-zinc-700/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  disabled={orgCreating}
                  className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold hover:bg-indigo-500 transition duration-150 shadow-sm disabled:opacity-50"
                >
                  {orgCreating ? "Creating..." : "Create Organization"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* User Info / Logout */}
        <div className="border-t border-zinc-800/60 pt-6 flex items-center justify-between">
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-zinc-200 truncate">{user.name || "User"}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs font-semibold text-red-400 hover:text-red-300 transition duration-150"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace Panel */}
      <main className="flex-1 p-10 flex flex-col">
        {selectedOrg ? (
          <div className="flex-1 flex flex-col">
            {/* Header info */}
            <div className="border-b border-zinc-800/60 pb-6 mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-extrabold text-white">{selectedOrg.name}</h1>
                <p className="text-zinc-500 text-sm mt-1">Slug: {selectedOrg.slug}</p>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 mb-6 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Grid of Workspaces */}
            <div className="flex-1 space-y-8">
              <div>
                <h2 className="text-lg font-bold text-zinc-300 mb-4">Workspaces</h2>
                {loadingWorkspaces ? (
                  <div className="flex py-10 justify-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className="bg-zinc-900 border border-zinc-800/80 p-6 rounded-xl hover:border-zinc-700/80 transition duration-200 shadow-md group relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition duration-200"></div>
                        <h3 className="font-bold text-white text-lg">{workspace.name}</h3>
                        <p className="text-xs text-zinc-500 mt-1">/{workspace.slug}</p>
                      </div>
                    ))}
                    {workspaces.length === 0 && (
                      <div className="col-span-full py-16 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                        <p className="text-zinc-500 text-sm">No workspaces inside this organization.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Create Workspace Form */}
              <div className="max-w-md bg-zinc-900/60 border border-zinc-800/80 p-6 rounded-xl shadow-lg pt-6 mt-10">
                <h3 className="text-base font-bold text-white mb-4">Create Workspace</h3>
                <form onSubmit={handleCreateWorkspace} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Engineering, Design, Marketing..."
                      value={newWorkspaceName}
                      onChange={(e) => {
                        setNewWorkspaceName(e.target.value);
                        setNewWorkspaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                      }}
                      className="w-full rounded-lg bg-zinc-850 border border-zinc-700/40 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2">
                      Workspace Slug
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="engineering"
                      value={newWorkspaceSlug}
                      onChange={(e) => setNewWorkspaceSlug(e.target.value)}
                      className="w-full rounded-lg bg-zinc-850 border border-zinc-700/40 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={workspaceCreating}
                    className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-sm font-semibold hover:from-purple-500 hover:to-indigo-500 transition duration-150 shadow-md disabled:opacity-50"
                  >
                    {workspaceCreating ? "Creating..." : "Create Workspace"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10">
            <h2 className="text-xl font-bold text-zinc-300">Welcome to Nexus AI</h2>
            <p className="text-zinc-500 text-sm mt-2 max-w-sm">
              Select or create an organization in the sidebar to view workspaces and start building AI pipelines.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
