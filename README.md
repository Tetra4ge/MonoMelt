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
| **API Gateway** | <img src="https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white" /> <img src="https://img.shields.io/badge/Express.js-404D59?style=flat" /> | Handles secure routing, JWT validation via Supabase, and orchestration across internal microservices. |
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
    Client <-->|REST API| Gateway
    Client -.->|JWT Login| Auth
    
    Gateway -->|Auth Check| Auth
    Gateway -->|Queue Job| Redis
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

```mermaid
graph TD
    %% Define Styles
    classDef ingest fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    classDef userReq fill:#2196F3,stroke:#1976D2,stroke-width:2px,color:#fff
    classDef process fill:#FF9800,stroke:#F57C00,stroke-width:2px,color:#fff
    classDef storage fill:#ff5722,stroke:#e64a19,stroke-width:2px,color:#fff
    classDef decision fill:#00BCD4,stroke:#0097A7,stroke-width:2px,color:#fff
    
    Upload((User Uploads Monolith)):::ingest
    Gateway[API Gateway & Auth]:::userReq
    Worker[Worker Extracts AST & Hashes]:::ingest
    StoreGraph[(Map to Neo4j & Postgres)]:::storage
    
    Upload --> Gateway
    Gateway --> Worker
    Worker --> StoreGraph
    
    Analyze[AI Analyzes Code Dependencies]:::process
    StoreGraph --> Analyze
    
    Prompt[Prompt LLMs via OpenRouter]:::process
    Analyze --> Prompt
    
    Check{Is Split Strategy Optimal?}:::decision
    Prompt --> Check
    
    Check -->|No - High Coupling Detected| Analyze
    
    Generate[Generate Terraform & Microservices]:::process
    Check -->|Yes - Domain Aligned| Generate
    
    Download((User Downloads Blueprint)):::userReq
    Generate --> Download
```

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

## 🚀 Local Setup & Installation

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
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Setup API Gateway
```bash
cd api-gateway
npm install
npm run dev
```
**`api-gateway/.env.example`**
```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
```

### 5. Setup Background Worker
```bash
cd worker
npm install
npm run dev
```
**`worker/.env.example`**
```env
REDIS_URL=redis://localhost:6379
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
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
PORT=8000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# LLM Providers
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key

# Vector Database
PINECONE_API_KEY=your_pinecone_api_key
```

```
