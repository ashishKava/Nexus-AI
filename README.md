<div align="center">

# ⚡ Nexus-AI Platform

**Enterprise Multi-Tenant AI Knowledge Base & Operational Telemetry Engine**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white)](https://www.fastify.io/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Container-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-36%20Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  A production-grade, polyglot monorepo engineered for distributed AI document retrieval (RAG), autonomous agentic tool calling, real-time telemetry streaming, and statistical anomaly detection.
</p>

[Architecture](#-system-architecture) •
[Features](#-key-features) •
[Tech Stack](#-technology-stack) •
[Quickstart](#-quickstart-with-docker) •
[API Reference](#-api-specification) •
[Engineering Decisions](#-architectural-decisions--trade-offs)

---

</div>

## 📌 Executive Summary

Modern AI applications require more than just basic LLM wrapper scripts. High-throughput distributed platforms must cleanly separate **concurrent I/O operations** from **computationally intensive mathematical computations**, maintain strict **multi-tenant data isolation**, and provide **actionable operational observability**.

**Nexus-AI** is architected as an enterprise-ready polyglot monorepo featuring:
1. **High-Performance API Gateway (`apps/api`)**: Built with Fastify 5 and TypeScript, enforcing multi-tenant Role-Based Access Control (RBAC) and schema validation with Zod.
2. **Dedicated AI & Analytics Microservice (`services/ai`)**: Built with Python 3.11 and FastAPI, powering a from-scratch Retrieval-Augmented Generation (RAG) vector pipeline and Pandas-based latency anomaly detection using Gaussian Z-score thresholds.
3. **Interactive Control Center (`apps/web`)**: Built with Next.js 16 (App Router), featuring interactive Recharts telemetry scatter plots, document knowledge base management, and a slide-out conversational AI Agent with autonomous tool-calling capabilities.
4. **Shared Type Safety Contract (`packages/types`)**: Zero contract-drift across all services via a shared `@nexus/types` package.

---

## 🏛 System Architecture

```mermaid
graph TD
    Client(["🌐 Client Browser / Operator"]) -->|HTTPS / Next.js 16 App Router| WebApp["💻 apps/web (Port 3000)"]
    
    subgraph "Edge & Gateway Tier"
        WebApp -->|REST API / Bearer JWT| FastifyAPI["⚡ apps/api Fastify 5 Gateway (Port 4000)"]
        FastifyAPI -->|Shared Contracts| SharedTypes["📦 packages/types (@nexus/types)"]
        WebApp -.->|Shared Contracts| SharedTypes
    end

    subgraph "Persistence Tier"
        FastifyAPI -->|SQL Queries via PrismaPg| Postgres[("🐘 PostgreSQL 17 Database")]
        FastifyAPI -->|Document Storage| VolumeUploads[("📁 Persistent Uploads Volume")]
    end

    subgraph "AI & Analytics Microservice Tier"
        FastifyAPI -->|Internal HTTP / Service Mesh| AIEngine["🐍 services/ai FastAPI Engine (Port 8000)"]
        AIEngine -->|Vector Math / Cosine Match| RAGStore[("🧠 RAG Vector Index")]
        AIEngine -->|Z-Score Outliers| PandasEngine["📊 Pandas Anomaly Detector"]
    end

    subgraph "External Intelligence Tier"
        FastifyAPI -->|Function Declarations| GeminiAPI["✨ Google Gemini 2.5 Flash API"]
        FastifyAPI -->|Offline Fallback Engine| LocalNLPEngine["⚙️ Deterministic NLP Parser"]
    end
```

---

## ✨ Key Features

### 1. Autonomous Agentic AI Assistant (Tool Calling)
* **Function Calling Loop**: The conversational assistant can understand natural language intents and autonomously execute actions on the user's behalf.
* **Integrated Tools**:
  * `createWorkspace(name, slug)`: Provisions isolated workspace partitions on the fly.
  * `listWorkspaces()`: Queries and summarizes organization spaces.
  * `getWorkspacePerformance()`: Analyzes active latency telemetry and returns statistical health summaries.
* **Resilient Dual-Mode Engine**: Automatically communicates with Google Gemini 2.5 Flash API when `GEMINI_API_KEY` is present, or falls back to an internal deterministic NLP rule engine for offline/zero-config environments.

### 2. Retrieval-Augmented Generation (RAG) from First Principles
* **Text Chunking Pipeline**: Dynamic sentence boundary splitting with configurable token chunk sizes and sliding overlap windows to preserve semantic continuity.
* **Vector Indexing & Retrieval**: English stopword elimination, Term Frequency-Inverse Document Frequency (TF-IDF) vectorization, and Cosine Similarity ranking.
* **Source-Attributed Synthesis**: Queries return structured answers accompanied by exact source document references, snippet context, and similarity confidence scores.

### 3. Statistical Operational Telemetry & Anomaly Detection
* **Gaussian Z-Score Outlier Detection**: Analyzes workspace event distributions using Pandas and NumPy. Data points with an absolute Z-score of:
  $$\left| Z \right| = \left| \frac{X - \mu}{\sigma} \right| > 2.0$$
  are dynamically flagged as operational latency anomalies.
* **Interactive Scatter Visualization**: Visualizes request latencies over time with color-coded normal operations versus anomaly spikes.
* **Synthetic Event Generator**: Built-in simulator to inject variable latency profiles (`api_request`, `model_inference`, `document_edit`, `user_login`) for stress testing.

### 4. Multi-Tenant Role-Based Access Control (RBAC)
* Hierarchical tenant structure: **Organizations $\rightarrow$ Workspaces $\rightarrow$ Resources**.
* Strict cryptographic authorization enforcing granular permissions across roles:
  * `OWNER`: Full administrative, member, and deletion rights.
  * `ADMIN`: Workspace and telemetry management.
  * `MEMBER`: Read-only and standard workspace event execution.

---

## 🛠 Technology Stack

| Layer | Technologies | Rationale |
| :--- | :--- | :--- |
| **Monorepo** | `pnpm` Workspaces | Lightning-fast deduplicated dependency graph and instant local package linking. |
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS, Recharts | Server-side rendering, standalone production output, and high-performance charting. |
| **API Gateway** | Fastify 5, TypeScript, Zod, `@fastify/jwt` | $3\times$ faster than Express; compiled schema validation and strict type safety. |
| **AI Engine** | Python 3.11, FastAPI, Uvicorn, Pandas, NumPy | Dedicated service for vectorized linear algebra and statistical data processing. |
| **Database** | PostgreSQL 17, Prisma ORM 7 (`@prisma/adapter-pg`) | Relational integrity, compound tenant indices, and type-safe migrations. |
| **DevOps** | Docker, Multi-Stage Builds, Docker Compose | Zero-dependency deployment; containerized healthchecks for production stability. |
| **Testing** | Vitest 4, Pytest 8, TestClient | Instant sub-second test execution across both Node and Python ecosystems. |

---

## 🚀 Quickstart with Docker

The entire polyglot stack (PostgreSQL + FastAPI + Fastify + Next.js) can be spun up with a single command.

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (macOS, Windows, or Linux)
* [pnpm](https://pnpm.io/) $\ge$ 10.x (optional, for local script execution)

### 1. Clone & Start Containers
```bash
# Clone the repository
git clone https://github.com/ashishKava/Nexus-AI.git
cd Nexus-AI

# Spin up all 4 production containers in the background
pnpm docker:up
# (or directly with Docker):
# docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Run Database Seeding
To initialize the database with the default administrative user, organizations, and 53 mock telemetry events:
```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma db seed
```

### 3. Access Your Live Environment
| Service | Endpoint | Default Credentials |
| :--- | :--- | :--- |
| **Web Dashboard** | `http://localhost:3000` | `admin@nexus.ai` / `password123` |
| **Fastify API Gateway** | `http://localhost:4000/health` | Bearer JWT Header |
| **Python AI Engine** | `http://localhost:8000/health` | Internal service / Open REST |
| **PostgreSQL Database** | `localhost:5432` | `nexus` / `nexus_password` (`db: nexus`) |

### 4. Container Management Commands
```bash
# View real-time aggregated streaming logs
pnpm docker:logs

# Stop all running containers
pnpm docker:down
```

---

## 💻 Local Development Workflow

If you prefer running services directly on your host machine:

### 1. Install Dependencies
```bash
# Install node packages across all monorepo workspaces
pnpm install

# Setup Python virtual environment
cd services/ai
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 2. Configure Environment Variables
Create `apps/api/.env`:
```env
DATABASE_URL="postgresql://nexus:nexus_password@localhost:5432/nexus?schema=public"
PORT=4000
HOST=0.0.0.0
AI_SERVICE_URL="http://localhost:8000"
JWT_SECRET="your-development-secret-key"
# Optional: Enable live Gemini LLM function calling
# GEMINI_API_KEY="your-google-gemini-api-key"
```

### 3. Launch All Services Concurrently
```bash
pnpm dev
```
This boots Fastify (`:4000`), Next.js (`:3000`), and FastAPI (`:8000`) simultaneously with hot-reloading.

---

## 🧪 Comprehensive Verification Suite

Nexus-AI includes an automated test matrix covering database operations, RBAC policies, RAG vector searches, and mathematical anomaly calculations:

```bash
# 1. Run all 29 TypeScript Fastify API integration tests
pnpm --filter api test

# 2. Run all 7 Python FastAPI AI Engine tests
cd services/ai
PYTHONPATH=. ./venv/bin/pytest
```

**Total: 36 Tests Passing (100% Pass Rate)**

```text
 ✓ src/__tests__/workspaces.test.ts (5 tests)
 ✓ src/__tests__/ai.test.ts (4 tests)
 ✓ src/__tests__/chat.test.ts (3 tests)
 ✓ src/__tests__/auth.test.ts (4 tests)
 ✓ src/__tests__/standaloneWorkspaces.test.ts (3 tests)
 ✓ src/__tests__/organizations.test.ts (4 tests)
 ✓ src/__tests__/documents.test.ts (2 tests)
 ✓ src/__tests__/app.test.ts (1 test)
 ✓ src/__tests__/users.test.ts (3 tests)
 ✓ services/ai/app/tests/test_analytics.py (4 tests)
 ✓ services/ai/app/tests/test_rag.py (3 tests)
```

---

## 📡 API Specification

All API endpoints are prefixed with `/api/v1` and protected with JWT Bearer Authentication.

### Authentication & Tenant Hierarchy
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user account | Public |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT token | Public |
| `POST` | `/api/v1/organizations` | Create tenant organization | Authenticated |
| `GET` | `/api/v1/organizations` | List user's organizations | Authenticated |
| `POST` | `/api/v1/organizations/:orgId/workspaces` | Create workspace partition | `OWNER`, `ADMIN` |
| `GET` | `/api/v1/workspaces/:workspaceId` | Retrieve workspace details | Org Member |

### Telemetry & Analytics
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/workspaces/:workspaceId/events` | Ingest operational telemetry event | Org Member |
| `GET` | `/api/v1/workspaces/:workspaceId/events` | Fetch all historical event series | Org Member |
| `GET` | `/api/v1/workspaces/:workspaceId/analytics` | Compute Z-Score anomalies via AI microservice | Org Member |

### Documents & RAG Pipeline
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/workspaces/:workspaceId/documents` | Multipart document upload & auto-vectorization | Org Member |
| `GET` | `/api/v1/workspaces/:workspaceId/documents` | List uploaded workspace documents | Org Member |
| `DELETE` | `/api/v1/workspaces/:workspaceId/documents/:id` | Delete document & purge vector embeddings | Org Member |
| `POST` | `/api/v1/workspaces/:workspaceId/documents/query` | Execute Cosine Similarity RAG query | Org Member |

### Conversational Agent
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/chat` | Conversational interface with autonomous tool execution | Org Member |

---

## 🧠 Architectural Decisions & Trade-Offs

#### 1. Why Fastify instead of Express?
* **Throughput**: Fastify is built on top of a low-overhead architecture achieving upwards of $70,000\text{ req/sec}$ compared to Express ($15,000\text{ req/sec}$).
* **Schema Compilation**: Fastify uses `fast-json-stringify` and Zod type providers, compiling serializers and validators at startup to prevent JSON injection and eliminate schema drift.

#### 2. Why a Separate Python FastAPI Service?
* Node.js is single-threaded and excels at non-blocking I/O (database queries, network requests, JWT verification).
* Python is the lingua franca of data engineering and machine learning. Performing DataFrame manipulations (NumPy, Pandas) or vector mathematics directly in the Node.js event loop would block the event loop for all concurrent users. Offloading compute to FastAPI keeps the API gateway responsive with $<5\text{ms}$ latency.

#### 3. Why Z-Score Anomaly Detection ($|Z| > 2.0$)?
* Operational latency data is approximately normally distributed around a mean under nominal conditions. By computing rolling population standard deviations:
  $$Z = \frac{x - \mu}{\sigma}$$
  any request taking more than $2$ standard deviations above the mean represents the $95\text{th}$ percentile outlier, providing immediate, objective detection of cold-starts, database deadlocks, or server degradation without static hardcoded thresholds.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
