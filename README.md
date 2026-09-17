<div align="center">
  <h1>MonoMELT</h1>
  <p><b>Legacy Monolith to Microservices Transformation Intelligence Platform</b></p>
</div>

> **An AI-powered, end-to-end transformation strategy platform that ingests monolithic codebases and generates a complete, production-ready microservice blueprint.**

Modern engineering teams don't just need to "split" code they need a cohesive, data driven transformation strategy. Blindly decomposing a monolith leads to cascading failures, data inconsistency, and performance cliffs. **MonoMELT** solves this by taking a monolith, deeply analyzing its Abstract Syntax Tree (AST), and generating a complete transformation blueprint with risk assessments, phase-by-phase migration plans, cost projections, team structure mapping, and generated Infrastructure-as-Code.

---

## Technology Stack

MonoMELT is built on a modern, decoupled microservice architecture:

| Component | Tech Stack & Tools | Description |
| :--- | :--- | :--- |
| **Frontend UI** | <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" /> <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white" /> <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white" /> | A highly interactive, dark-mode composer featuring dynamic dependency graphs and multi-scenario blueprint builders. |
| **API Gateway** | <img src="https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white" /> <img src="https://img.shields.io/badge/Express.js-404D59?style=flat" /> <img src="https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white" /> | Handles secure routing, JWT validation via Supabase, orchestration, and real-time WebSocket notifications. |
| **AI Engine** | <img src="https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white" /> <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" /> | The brain of the platform that coordinates decomposition and architectural strategies. |
| **LLM Provider** | <img src="https://img.shields.io/badge/OpenRouter-000000?style=flat" /> <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat&logo=googlegemini&logoColor=white" /> | Primary reasoning engine powered by OpenRouter, with Google Gemini configured as a robust fallback for high-availability. |
| **Async Worker** | <img src="https://img.shields.io/badge/BullMQ-FF4B4B?style=flat" /> <img src="https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white" /> | Background job processor for heavy tasks like AST extraction, ZIP processing, and file generation. |
| **Databases** | <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" /> <img src="https://img.shields.io/badge/Neo4j-018bff?style=flat&logo=neo4j&logoColor=white" /> <img src="https://img.shields.io/badge/Pinecone-000000?style=flat&logo=pinecone&logoColor=white" /> | Relational data is stored in Postgres (Supabase). Code dependencies and service boundaries are mapped in Neo4j. Vector embeddings are stored in Pinecone. |

---

## Architecture Diagram

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#1E293B,stroke:#3B82F6,stroke-width:2px,color:#fff
    classDef gateway fill:#0F172A,stroke:#10B981,stroke-width:2px,color:#fff
    classDef service fill:#111,stroke:#8B5CF6,stroke-width:2px,color:#fff
    classDef data fill:#0a0a0a,stroke:#F59E0B,stroke-width:2px,color:#fff
    
    %% Nodes
    Client[("React Frontend<br/>(SPA)")]:::client
    
    Gateway["API Gateway<br/>(Node/Express)"]:::gateway
    
    Auth["Auth Service<br/>(Supabase)"]:::data
    Worker["Background Worker<br/>(BullMQ/Node)"]:::service
    AI["AI Service<br/>(FastAPI/Python)"]:::service
    
    Redis[("Redis Cache")]:::data
    Postgres[("Supabase<br/>(PostgreSQL)")]:::data
    Neo4j[("Neo4j<br/>(Graph DB)")]:::data
    
    %% Connections
    Client <-->|REST API & WebSockets| Gateway
    Client -.->|JWT Login| Auth
    
    Gateway -->|Auth Check| Auth
    Gateway -->|Queue Job| Redis
    Gateway <-->|Redis Pub/Sub| Redis
    Gateway <-->|Read/Write| Postgres
    Gateway <-->|Decomposition| AI
    
    Redis -->|Process Job| Worker
    Worker -->|Ingest/Extract| Postgres
    Worker -->|Parse AST| Neo4j
    
    AI <-->|Graph Analysis| Neo4j
    AI <-->|Prompt LLMs| External[("OpenRouter API")]
```

---

## 🔄 Backend Data Flow

![Backend Data Flow](Images/MonoMelt%20Backend.png)

---

## 🌟 Core Features

### 1. Zero-Touch Repository Ingestion
Upload a legacy ZIP file or point to a GitHub repository. MonoMELT's async background workers will seamlessly parse the repository structure, compute file hashes, and extract language metadata.

### 2. AI-Driven Service Decomposition
Leveraging Large Language Models and Neo4j graph algorithms, MonoMELT generates multiple tailored decomposition scenarios for the user:
- **Aggressive Split:** Maximum service distribution and scaling.
- **Conservative Split:** Fewer services to minimize initial migration friction.
- **Domain-Driven:** Strictly aligned with bounded business domains.

### 3. Visual Dependency Mapping
A fully interactive Neo4j-powered dependency graph that visually clusters source files into their newly proposed microservice boundaries, allowing users to visually inspect circular dependencies and hotspots.

### 4. Interactive Strategic Planning
Before touching any code, MonoMELT generates a comprehensive transformation roadmap, complete with:
- **Cost vs. Performance Panels:** Projected monthly infrastructure costs.
- **Team Ownership Matrix:** AI-suggested team assignments to minimize cross-team friction (Conway's Law).
- **Migration Timeline:** A phased, step-by-step Gantt chart to safely roll out the new architecture.

### 5. Instant Infrastructure-as-Code Export
Once a plan is finalized, MonoMELT dynamically generates a ZIP bundle containing:
- Boilerplate Python/FastAPI code for the new microservices.
- `docker-compose.yml` for local testing.
- `main.tf` (Terraform) files for AWS infrastructure provisioning.

### 6. Live Deployment Simulation
Provides a stunning, highly-interactive "Live Terminal" UI to simulate a complete CI/CD pipeline (Building Images, Provisioning Infrastructure, Starting Services, Health Checks), ending in a live Services Dashboard metric view.

---

## The 6 Intelligence Agents

MonoMELT’s core processing pipeline is driven by a symphony of specialized AI agents, each handling a distinct phase of the complex monolithic transformation process. 

### 1. Analysis Agent
**Source Code Ingestion & Graph Construction (`ast_parser.py` & `graph_builder.py`)**
The pipeline begins by deeply analyzing the legacy monolith without executing it. The Analysis Agent parses raw source files (Python, JavaScript, TypeScript) and generates a normalized Abstract Syntax Tree (AST). It extracts symbols, internal references, external package imports, and function calls. It then hands this structured data over to a Graph Builder, which constructs a highly connected, tenant-isolated dependency graph in **Neo4j**. This results in a mathematical model of exactly how every file and class in the monolith relies on one another.

### 2. Intelligence Agent
**Code Smell & Domain Extraction (`enrichment.py`)**
With the graph constructed, the Intelligence Agent performs deep LLM-driven analysis across the codebase. It doesn't just look at syntax; it infers bounded contexts and domain boundaries. It identifies severe anti-patterns (like God Classes or circular dependencies), flags high-risk security vulnerabilities, and highlights hidden coupling that would normally cause microservices to fail in production. This agent annotates the Neo4j graph with these intelligence findings.

### 3. Decomposition Agent
**Algorithmic Boundary Detection (`decomposition_engine.py`)**
This agent is responsible for the actual "splitting" of the monolith. Instead of guessing, it applies rigorous graph theory algorithms (such as the Louvain method for community detection) to mathematically divide the Neo4j graph into optimal microservice clusters. It generates multiple distinct scenarios for the user to choose from—such as an "Aggressive Split" for maximum scalability or a "Conservative Split" to minimize initial migration friction ensuring the resulting microservices have high cohesion and low coupling.

### 4. Planning Agent
**Strategic Migration & Cost Projections (`planning_engine.py`)**
Before a single line of code is moved, the Planning Agent calculates the business and operational impact of the transformation. It simulates the monthly cloud infrastructure costs of the new microservices, maps the new architecture to engineering teams using Conway's Law (to minimize cross-team friction), and generates a phased, step-by-step migration roadmap to ensure zero downtime during the transition.

### 5. Blueprint Generator Agent
**Infrastructure-as-Code Execution (`blueprint_generator.py`)**
Once a strategy is approved, the Blueprint Agent acts as the final execution engine. It deterministically translates the abstract microservice design into a ready-to-deploy `.zip` package. This bundle includes boilerplate FastAPI/Express server code, Kubernetes manifests, `docker-compose` networks, Terraform scripts for AWS provisioning, and formally documented Architecture Decision Records (ADRs).

### 6. Report Generator Agent
**Executive Summarization (`report_generator.py`)**
The final agent aggregates the output of all the previous phases and translates the deep technical metrics into a human-readable, business-facing JSON report. It prompts the LLM to write an executive summary justifying the cost multipliers and architectural shifts, which is then fed directly to the React frontend dashboard in real-time via WebSockets.

---

## Agent Data Flow

![Agent Flow](Images/agent_flow.png)

---

## Local Setup & Installation

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **Docker & Docker Compose** (for local Neo4j & Redis)
- **Supabase Project** (Database, Auth, and Storage)

### 1. Clone the Repository
```bash
git clone https://github.com/Tetra4ge/MonoMelt.git
cd MonoMelt
```

### 2. Global Infrastructure (Docker)
Start the required local databases (Redis):
```bash
docker-compose up -d
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
**`frontend/.env.example`**
```env
# --- Frontend Environment Variables ---

# API Gateway URLs
VITE_API_DEV_URL=http://localhost:4000
VITE_API_PRO_URL=https://project_name.onrender.com

# Execution Mode (development | production)
VITE_MODE=development

# WebSocket URL for real-time updates (AST parsing progress, etc.)
VITE_WS_URL=ws://localhost:4000

# Supabase Auth & Database (Public Keys)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

### 4. Setup API Gateway
```bash
cd api-gateway
npm install
npm run dev
```
**`api-gateway/.env.example`**
```env
# --- API Gateway Environment Variables ---

# Server Config
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# AI Service Connection
AI_SERVICE_DEV_URL=http://localhost:8000
AI_SERVICE_PRO_URL=https://your-ai-service.onrender.com

# Supabase Configuration & Authentication
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_JWT_SECRET=your-super-secret-jwt-string
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-never-share

# Core Databases
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
REDIS_URL=redis://localhost:6380

# (Optional) GitHub OAuth for repo importing
GITHUB_CLIENT_ID=your_github_oauth_id
GITHUB_CLIENT_SECRET=your_github_oauth_secret
```
### 5. Setup Background Worker
```bash
cd worker
npm install
npm run dev
```
**`worker/.env.example`**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

REDIS_URL=redis://localhost:6379

AI_SERVICE_URL=http://localhost:8000

MAX_SOURCE_FILES=10000
MAX_EXTRACTED_BYTES=209715200
```

### 6. Setup AI Engine
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
**`ai-service/.env.example`**
```env
# --- AI Analysis Service Environment Variables ---

# Server Config
PORT=8000

# Core Database & Storage (Supabase)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-never-share
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres

# Graph Database (Neo4j)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Vector Database (Pinecone)
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=us-east-1

# AI Engine API (OpenRouter or Gemini)
OPENROUTER_API_KEY=sk-or-v1-...
GEMINI_API_KEY=your_gemini_api_key
```

---

<div align="center">
  <br/>
  <b>Built by Team <a href="https://github.com/Tetra4ge">TetraFourge</a></b>
</div>
