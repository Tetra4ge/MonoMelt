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
