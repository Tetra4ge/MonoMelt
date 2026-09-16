import asyncio
from pydantic import BaseModel
from typing import List, Dict, Optional
from supabase import create_client, Client
from neo4j import AsyncGraphDatabase
from core.config import settings
from services.llm_provider import generate_content

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
