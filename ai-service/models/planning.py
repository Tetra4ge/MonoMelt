"""
Pydantic schemas for Phase 6 Migration Planning Engine.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID


class PlanAssumptions(BaseModel):
    cloud_provider: str = Field("aws", description="aws | azure | gcp")
    pricing_region: str = Field("us-east-1", description="Cloud region for pricing catalog")
    cost_multiplier: float = Field(1.0, ge=0.5, le=3.0, description="Multiplier for infrastructure scaling")
    team_count: int = Field(3, ge=1, le=20, description="Number of available engineering teams")
    risk_tolerance: str = Field("medium", description="low | medium | high risk tolerance")
    migration_window_months: int = Field(6, ge=1, le=36, description="Target migration window in months")


class MigrationStage(BaseModel):
    stage_number: int
    name: str
    description: str
    target_services: list[str]
    effort_estimate_weeks: int
    rollout_method: str  # strangler_fig | direct | blue_green
    rollback_condition: str
    success_metric: str


class RoadmapPlan(BaseModel):
    pattern_recommended: str  # strangler_fig | modular_monolith
    total_duration_weeks: int
    stages: list[MigrationStage]


class ConsistencySecurityItem(BaseModel):
    source_service: str
    target_service: str
    operation_type: str  # write | read | event
    recommended_pattern: str  # saga | outbox | cqrs | direct
    data_category: str  # sensitive | transactional | operational
    encryption_required: bool
    audit_required: bool


class ConsistencySecurityMatrix(BaseModel):
    items: list[ConsistencySecurityItem]
    risk_summary: str


class CostPerformanceSimulation(BaseModel):
    monolith_monthly_cost_usd: float
    microservices_monthly_cost_usd: float
    cost_range_min_usd: float
    cost_range_max_usd: float
    avg_latency_increase_ms: float
    sensitivity_drivers: list[str]


class TeamAssignment(BaseModel):
    team_name: str
    assigned_services: list[str]
    capacity_status: str  # optimal | overloaded | underutilized
    spof_warning: Optional[str] = None


class TeamMappingPlan(BaseModel):
    team_assignments: list[TeamAssignment]
    unassigned_services: list[str]


class GeneratePlanRequest(BaseModel):
    scenario_revision_id: UUID
    proposed_services: list[dict[str, Any]] = Field(default_factory=list)
    assumptions: Optional[PlanAssumptions] = None


class PlanReportResponse(BaseModel):
    success: bool
    assumptions: PlanAssumptions
    roadmap: RoadmapPlan
    consistency_security: ConsistencySecurityMatrix
    cost_performance: CostPerformanceSimulation
    team_mapping: TeamMappingPlan
