# MonoMelt v2: Phase 2 (AI Service Core Generator)

## 1. Phase Overview

Phase 2 focuses on building the intelligence and data-aggregation engine within the Python/FastAPI microservice (`ai-service`). This is where the 6th Agent—the **Report Agent**—actually lives. 

While Phase 1 prepared the database to *store* the reports, Phase 2 is responsible for *generating* them. The Report Agent must execute a complex, distributed fan-out query to gather the disparate data fragments left behind by Agents 1 through 5, synthesize them using Pydantic models, invoke an LLM for an executive summary, and construct the final, unified JSON payload.

This document serves as the comprehensive, 150+ line technical specification for executing Phase 2.

---

## 2. Architectural Objectives

### 2.1 The Fan-Out Data Aggregation Strategy
The biggest challenge of Agent 6 is that the data it needs lives in two entirely different database paradigms:
1.  **Tabular/Relational Data (PostgreSQL via Supabase):** Cost calculations, team mappings, and security risks are highly structured and live in standard SQL tables (`cost_performance`, `plan_revisions`, etc.).
2.  **Graph Data (Neo4j):** The actual microservice boundaries, domain contexts, and inter-service communication dependencies live as nodes and edges in the graph database.

The Report Agent must utilize Python's `asyncio` to fetch from both databases concurrently, ensuring the aggregation process does not become a synchronous bottleneck.

### 2.2 Pydantic Validation
To guarantee that the resulting JSON report is completely predictable (crucial for Phase 5 React rendering and Phase 6 Notion mapping), the output must be strictly typed using Pydantic models. If the raw data fetched from the databases is malformed, Pydantic will catch the validation error before the report is ever saved.

### 2.3 LLM-Powered Synthesis
Raw data is not enough for an "Executive Report." The Agent will utilize the existing `LLMProvider` (Google Gemini / OpenRouter) to read the raw aggregated metrics and generate a 2-paragraph `executive_summary.business_impact` statement written in clear, business-facing language.

---

## 3. Core Class Design: `ReportAgent`

The logic will be encapsulated in a new service class located at `ai-service/services/report_generator.py`.

### 3.1 Pydantic Output Schemas
Before writing the execution logic, we must define the exact shape of the output.

```python
from pydantic import BaseModel
from typing import List, Dict, Optional

class ExecutiveSummary(BaseModel):
    total_services_extracted: int
    overall_risk_score: str
    estimated_timeline_months: int
    business_impact: str

class DecompositionService(BaseModel):
    service_name: str
    rationale: str
    dependencies: List[str]
    team_allocation: int

class CostAnalysis(BaseModel):
    current_monolith_cost_monthly: float
    projected_microservices_cost_monthly: float
    infrastructure_multiplier: float
    breakdown: Dict[str, float]

class RiskAssessment(BaseModel):
    critical_paths: List[str]
    data_consistency_flags: List[str]
    mitigation_strategies: List[str]

class FinalReport(BaseModel):
    project_id: str
    executive_summary: ExecutiveSummary
    decomposition_strategy: List[DecompositionService]
    cost_analysis: Optional[CostAnalysis]
    risk_assessment: Optional[RiskAssessment]
```

### 3.2 The Aggregation Logic

```python
import asyncio
from supabase import create_client, Client
from neo4j import AsyncGraphDatabase
from app.core.config import settings
from app.services.llm_provider import generate_content

class ReportAgent:
    def __init__(self, project_id: str, supabase_client: Client):
        self.project_id = project_id
        self.supabase = supabase_client
        self.neo4j_driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI, 
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )

    async def _fetch_postgres_context(self) -> dict:
        """Fetches Cost, Risk, and Planning data concurrently."""
        # Using Supabase Service Role to bypass RLS for internal worker
        plan_res = self.supabase.table('plan_revisions')\
            .select('*')\
            .eq('project_id', self.project_id)\
            .order('created_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not plan_res.data:
            raise ValueError(f"No completed planning data found for project {self.project_id}")
            
        return plan_res.data[0]

    async def _fetch_neo4j_context(self) -> list:
        """Executes a Cypher query to retrieve microservice boundaries and dependencies."""
        cypher_query = """
            MATCH (m:Microservice {project_id: $pid})
            OPTIONAL MATCH (m)-[:DEPENDS_ON]->(dep:Microservice)
            RETURN m.name AS service_name, m.rationale AS rationale, collect(dep.name) AS dependencies
        """
        async with self.neo4j_driver.session() as session:
            result = await session.run(cypher_query, pid=self.project_id)
            records = await result.data()
            return records

    async def _generate_executive_summary(self, raw_data: dict) -> str:
        """Prompts the LLM to write a business-facing summary of the technical data."""
        prompt = f"""
        Act as a Principal Cloud Architect. Review the following microservice decomposition data:
        Total Services: {raw_data.get('total_services')}
        Cost Multiplier: {raw_data.get('cost_multiplier')}
        
        Write a concise, 2-paragraph executive summary explaining the business impact of this migration.
        """
        response = await generate_content(prompt)
        return response.text

    async def build_report(self) -> FinalReport:
        """Orchestrates the fan-out query and builds the Pydantic model."""
        # 1. Fetch data from DBs concurrently
        pg_data, neo4j_data = await asyncio.gather(
            self._fetch_postgres_context(),
            self._fetch_neo4j_context()
        )
        
        # 2. Extract specific domains
        cost_data = pg_data.get('cost_performance', {})
        risk_data = pg_data.get('consistency_security', {})
        
        # 3. Generate LLM Summary
        summary_text = await self._generate_executive_summary({
            "total_services": len(neo4j_data),
            "cost_multiplier": cost_data.get('infrastructure_multiplier', 1.0)
        })
        
        # 4. Construct Pydantic Model
        report = FinalReport(
            project_id=self.project_id,
            executive_summary=ExecutiveSummary(
                total_services_extracted=len(neo4j_data),
                overall_risk_score=risk_data.get('overall_risk', 'UNKNOWN'),
                estimated_timeline_months=pg_data.get('roadmap', {}).get('estimated_months', 0),
                business_impact=summary_text
            ),
            decomposition_strategy=[
                DecompositionService(
                    service_name=s['service_name'],
                    rationale=s['rationale'],
                    dependencies=s['dependencies'],
                    team_allocation=3 # Default baseline, overridden by team_mapping if available
                ) for s in neo4j_data
            ],
            cost_analysis=CostAnalysis(**cost_data) if cost_data else None,
            risk_assessment=RiskAssessment(**risk_data) if risk_data else None
        )
        
        return report
```

---

## 4. Error Handling & Edge Cases

### 4.1 Missing Predecessor Data
If the user attempts to generate a report before Agent 4 (Cost Calculation) has finished, `_fetch_postgres_context()` might return a row where `cost_performance` is `null`. The `FinalReport` Pydantic model utilizes `Optional[CostAnalysis]`, allowing the report to generate successfully with a `null` cost section, rather than throwing a catastrophic 500 error. The React frontend (Phase 5) will be programmed to display a "Data Unavailable" placeholder if these nested objects are missing.

### 4.2 LLM Timeout / Rate Limit
If the call to `generate_content()` in `_generate_executive_summary()` fails due to an OpenRouter/Gemini timeout, the exception must be caught. The system should gracefully degrade by injecting a hardcoded fallback string (e.g., *"Executive summary generation failed due to AI provider timeout. Please review the raw metrics below."*) rather than failing the entire report generation.

### 4.3 Neo4j Connection Failure
If the `AsyncGraphDatabase.driver` fails to connect to AuraDB (a common issue on the Free Tier), the `build_report` function must catch the `neo4j.exceptions.ServiceUnavailable` error, halt the report generation, and ensure the `project_reports` table (Phase 1) is updated to `status = 'failed'`, allowing the BullMQ worker to gracefully mark the job as failed.

---

## 5. Integration Hand-Off (To Phase 3)

With the `ReportAgent` class fully defined, the Python application now possesses the internal logic required to aggregate and format the data.

However, this logic is currently dormant. In **Phase 3**, we will construct the FastAPI routing layer (`POST /api/routes/reports.py`) to expose this class to the external Node.js API Gateway, handle the incoming HTTP requests, and perform the actual SQL `UPSERT` commands to write the resulting JSON payload into the `project_reports` table created in Phase 1.
