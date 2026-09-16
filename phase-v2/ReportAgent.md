# MonoMelt v2: Agent 6 (Report Agent) Technical Specification & Architecture Document

## 1. Executive Summary

As the final step in the MonoMelt monolith-to-microservices transformation pipeline, the **Report Agent (Agent 6)** serves as the ultimate data aggregator and presentation layer. While Agents 1 through 5 handle the highly specialized tasks of parsing Abstract Syntax Trees (ASTs), generating Domain-Driven Design (DDD) boundaries, calculating cloud cost multipliers, and assessing security risks, their outputs remain isolated across Neo4j graph nodes and PostgreSQL tables.

The Report Agent acts as the vital bridge between raw architectural data and human-readable strategic insights. It is responsible for aggregating all cross-agent outputs, structuring them into a unified, version-controlled JSON schema, and distributing this intelligence through a Dual-Output Strategy:
1.  **Internal Dashboard:** A highly interactive, dynamic React interface embedded directly within the MonoMelt application.
2.  **External Workspace (Notion):** A secure, formatted push to an enterprise Notion workspace utilizing the Model Context Protocol (MCP) to automate block generation.

This document serves as the comprehensive, 180+ line technical specification required for implementing Phase v2 of the MonoMelt platform.

---

## 2. System Architecture & Data Flow

The Report Agent operates asynchronously at the tail end of the processing pipeline. It utilizes a distributed microservice architecture spanning Node.js (BullMQ/Express) and Python (FastAPI).

### 2.1 The Event-Driven Trigger Mechanism
The generation of a report is a computationally heavy operation that requires strict sequencing. It must only trigger when the system has verified that all predecessor agents have achieved a `status = 'completed'` state in the database.

1.  **Completion Hook:** The BullMQ worker tracking the `decomposition-pipeline` emits a `pipeline:completed` event.
2.  **Job Enqueueing:** The API Gateway captures this event and pushes a `generate-report` job to the Redis queue, associating it with the specific `project_id`.
3.  **FastAPI Invocation:** The background worker picks up the job and sends a REST `POST` request to the AI Service (`/reports/generate/{project_id}`).

### 2.2 Data Aggregation Engine (Python)
The core of the Report Agent lives in the Python AI Service. It performs a multi-database fan-out query:

*   **Neo4j Graph Database:** Executes Cypher queries to extract the final microservice boundaries, interface contracts, and dependency flow metrics.
*   **PostgreSQL (Supabase):** Retrieves the risk assessment matrices, target cloud provider configurations, team assignments, and the generated execution timeline (roadmap).
*   **LLM Refinement:** The aggregated raw data is optionally passed through a lightweight LLM prompt (via OpenRouter/Gemini) to generate an "Executive Summary" paragraph summarizing the technical findings in business language.

### 2.3 The Dual-Output Strategy

#### 2.3.1 Output A: React Dashboard (Primary Source of Truth)
The generated JSON report is saved back to PostgreSQL. The React frontend polls the API Gateway (`GET /api/reports/:projectId`) until the status transitions to `completed`. 
The frontend maps the JSON payload to pre-built React components (e.g., Recharts for cost graphs, Tailwind grids for risk matrices).

#### 2.3.2 Output B: Notion MCP Integration (External Export)
When a user clicks "Export to Notion", the API Gateway triggers a secondary workflow:
1.  The Gateway pulls the finalized JSON report.
2.  It translates the JSON into a Notion-compatible payload.
3.  It invokes the local Notion MCP (Model Context Protocol) connector.
4.  The MCP connector communicates with the Notion API, dynamically generating Heading Blocks, Paragraph Blocks, and Table Blocks, nesting them under a newly created Notion Database Page.

---

## 3. The Unified Report JSON Schema

The output of the Report Agent is a strict JSON structure. This ensures compatibility across both the React dashboard and the Notion MCP translation layer.

```json
{
  "report_id": "rep_12345abc",
  "project_id": "proj_9876xyz",
  "version": "v1",
  "generated_at": "2026-09-16T23:00:00Z",
  "executive_summary": {
    "total_services_extracted": 12,
    "overall_risk_score": "MEDIUM",
    "estimated_timeline_months": 8,
    "business_impact": "Migrating to microservices will reduce deployment friction by 40%..."
  },
  "decomposition_strategy": [
    {
      "service_name": "auth-service",
      "rationale": "Handles all JWT issuance and user identity verification.",
      "dependencies": ["database-core"],
      "team_allocation": 3
    }
  ],
  "cost_analysis": {
    "current_monolith_cost_monthly": 1200,
    "projected_microservices_cost_monthly": 1850,
    "infrastructure_multiplier": 1.54,
    "breakdown": {
      "compute": 1200,
      "networking": 400,
      "managed_databases": 250
    }
  },
  "risk_assessment": {
    "critical_paths": ["PaymentGateway -> OrderProcessing"],
    "data_consistency_flags": ["Shared mutable state in Inventory table"],
    "mitigation_strategies": ["Implement Saga pattern for distributed transactions"]
  }
}
```

---

## 4. Detailed Implementation Phases (The 6-Phase Plan)

To ensure smooth integration with the existing MonoMelt infrastructure, the development of the Report Agent is broken down into 6 distinct, sequential phases.

### Phase 1: Database & Schema Preparation
The foundation requires establishing persistent storage for the reports.
*   **Table Creation:** A new table named `project_reports` is created in Supabase.
*   **Columns:** `id` (UUID), `project_id` (FK), `version` (Integer), `payload` (JSONB), `status` (Enum: pending, generating, completed, failed), `notion_url` (String, nullable).
*   **RLS Policies:** Row Level Security must be configured so users can only `SELECT` reports tied to their specific `user_id` via the `projects` table relation. The API Gateway will use the Service Role key to bypass RLS during the `INSERT` phase.

### Phase 2: AI Service Core Generator (Python)
This phase implements the heavy lifting of data extraction and formatting.
*   **File:** `ai-service/services/report_generator.py`
*   **Class:** `ReportAgent`
*   **Methods:**
    *   `_fetch_neo4j_context()`: Executes Cypher queries to grab bounding contexts.
    *   `_fetch_postgres_context()`: Pulls cost and risk arrays.
    *   `_generate_executive_summary()`: Assembles the LLM prompt and parses the string response.
    *   `build_report()`: Orchestrates the fetches and constructs the final Pydantic model representing the JSON schema.

### Phase 3: AI Service API Endpoints
Exposing the Python logic to the rest of the cluster.
*   **File:** `ai-service/api/routes/reports.py`
*   **Endpoint:** `POST /reports/generate/{project_id}`
*   **Idempotency Handling:** The route first checks Supabase to see if a report already exists for this project. If it does, it increments the `version` integer (e.g., generating `report_v2` instead of overwriting `report_v1`). This provides a historical audit trail of architectural changes.

### Phase 4: Async Orchestration & API Gateway (Node.js)
Managing the workflow and serving the data to the client.
*   **BullMQ Integration:** In `worker/index.js`, register the `generate-report` queue handler. When executed, it sends an HTTP request to the FastAPI endpoint created in Phase 3.
*   **Express Routes:** In `api-gateway/routes/reports.routes.js`, implement:
    *   `GET /api/reports/:projectId` (Fetches the latest report from Supabase).
    *   `GET /api/reports/:projectId/history` (Fetches all versions for the dropdown UI).

### Phase 5: React Frontend (Report Dashboard)
Building the interactive user interface.
*   **Component:** `ReportPage.tsx`
*   **State Management:** React Query (`useQuery`) is utilized to fetch and cache the report JSON.
*   **UI Components:**
    *   A Hero section displaying the Executive Summary and key metrics (Total Services, Risk Score).
    *   A grid layout displaying the Decomposition Strategy, using Tailwind CSS cards for each microservice.
    *   Recharts implementation to visualize the "Monolith vs Microservices" cost comparison.
*   **UX:** A "Regenerate Report" button (which triggers a v2 generation) and an "Export to Notion" button (which triggers Phase 6).

### Phase 6: Notion MCP Integration
The final phase connects MonoMelt to external enterprise tooling.
*   **Endpoint:** `POST /api/reports/:projectId/export-to-notion`
*   **Logic Flow:**
    1.  The API Gateway receives the request and fetches the JSON payload from Supabase.
    2.  A translation utility (`notion.util.js`) maps the JSON keys to Notion block types. For example, `report.executive_summary.business_impact` becomes a `paragraph` block, while `report.cost_analysis.breakdown` becomes a `table` block.
    3.  The Gateway executes a call to the connected Model Context Protocol (MCP) server configured for Notion.
    4.  Upon successful creation, the MCP returns the target Notion Page URL.
    5.  The Gateway updates the `project_reports` table, setting the `notion_url` column.
    6.  The React frontend receives the 200 OK response and displays a clickable link: *"View in Notion"*.

---

## 5. Error Handling & Edge Cases

*   **Incomplete Predecessor Data:** If Agent 4 (Cost Calc) fails, the Report Agent must not crash. It should gracefully degrade, inserting `"cost_analysis": null` and appending a warning string to the Executive Summary stating that cost projections are currently unavailable.
*   **Notion Rate Limiting:** Notion's API is strictly rate-limited. If the MCP connector returns a 429 Too Many Requests, the API Gateway must implement an exponential backoff retry strategy before failing the export request and alerting the user.
*   **Graph Visualization:** Because Notion cannot natively render interactive JavaScript graphs, the Neo4j visualization is intentionally omitted from the Notion export. Instead, a deep link URL is inserted into the Notion document, pointing the user back to the `/analysis/:projectId` route within the MonoMelt dashboard to view the interactive map.

---
*End of Technical Specification.*
