import logging
import json
from pydantic import BaseModel, Field
from typing import List
from db.neo4j_client import run_query
from db.pg_client import execute
from services.llm_provider import extract_structured_data

logger = logging.getLogger(__name__)

# Define our expected schema for LLM outputs
class Finding(BaseModel):
    finding_type: str = Field(..., description="The type of finding: 'domain', 'risk', or 'sensitivity'")
    explanation: str = Field(..., description="Detailed explanation of what the LLM found")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")
    subject_ids: List[str] = Field(..., description="List of node_ids from the graph involved in this finding")
    evidence_ids: List[str] = Field(default_factory=list, description="List of edge or node IDs acting as evidence")

class IntelligenceReport(BaseModel):
    findings: List[Finding]

async def run_intelligence_pipeline(project_id: str, source_version_id: str, owner_id: str):
    """
    1. Extract a subset of the graph from Neo4j
    2. Feed to LLM via llm_provider
    3. Save results to Postgres (ai_findings table)
    """
    logger.info(f"Starting Intelligence Pipeline for project: {project_id}")
    
    # 1. Fetch graph data from Neo4j (Files, Symbols, Dependencies)
    query = """
    MATCH (n {source_version_id: $svid})
    WHERE n:File OR n:Symbol OR n:ExternalDependency
    RETURN n.node_id AS id, labels(n)[0] AS label, n.name AS name, n.file_path AS file_path
    LIMIT 200
    """
    try:
        nodes = await run_query(query, {"svid": source_version_id})
    except Exception as e:
        logger.error(f"Failed to fetch graph from Neo4j: {e}")
        return
        
    if not nodes:
        logger.warning("Graph is empty, skipping intelligence pipeline.")
        return

    # Prepare context for LLM
    context_str = json.dumps([dict(n) for n in nodes], indent=2)
    prompt = f"""
    Analyze the following extracted architecture graph nodes from a software repository.
    Identify:
    1. Potential Bounded Contexts or Microservice Domains (e.g., 'Auth Domain', 'Payment Domain').
    2. Architectural Risks (e.g., God classes, circular dependencies).
    3. Data Sensitivity (e.g., nodes handling PII, credentials).
    
    Graph Nodes:
    {context_str}
    
    Return a list of findings matching the JSON schema.
    """
    
    logger.info("Sending graph data to LLM for analysis...")
    
    try:
        # 2. Feed to LLM
        report = await extract_structured_data(prompt, response_schema=IntelligenceReport)
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return
        
    # 3. Store findings in postgres
    logger.info(f"LLM generated {len(report.findings)} findings. Storing in database...")
    for finding in report.findings:
        await execute(
            """
            INSERT INTO public.ai_findings (
                project_id, source_version_id, owner_id, finding_type, 
                subject_ids, explanation, confidence, evidence_ids
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            project_id, source_version_id, owner_id, finding.finding_type,
            json.dumps(finding.subject_ids), finding.explanation,
            finding.confidence, json.dumps(finding.evidence_ids)
        )
        
    logger.info("Intelligence pipeline completed successfully.")
