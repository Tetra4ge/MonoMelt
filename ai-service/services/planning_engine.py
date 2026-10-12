"""
Phase 6 Migration Planning Engine.
Calculates actionable migration roadmaps, consistency/security matrices, cost/performance simulations, and team mappings.
"""

from typing import Any
import math
from models.planning import (
    PlanAssumptions,
    MigrationStage,
    RoadmapPlan,
    ConsistencySecurityItem,
    ConsistencySecurityMatrix,
    CostPerformanceSimulation,
    TeamAssignment,
    TeamMappingPlan,
    PlanReportResponse
)


class PlanningEngine:
    def __init__(self, proposed_services: list[dict[str, Any]], assumptions: PlanAssumptions | None = None):
        self.proposed_services = proposed_services or []
        self.assumptions = assumptions or PlanAssumptions()

    def generate_plan(self) -> PlanReportResponse:
        roadmap = self._generate_roadmap()
        consistency_security = self._generate_consistency_security()
        cost_performance = self._generate_cost_performance()
        team_mapping = self._generate_team_mapping()

        return PlanReportResponse(
            success=True,
            assumptions=self.assumptions,
            roadmap=roadmap,
            consistency_security=consistency_security,
            cost_performance=cost_performance,
            team_mapping=team_mapping
        )

    def _service_names(self) -> list[str]:
        return [s.get("name") or f"service-{i+1}" for i, s in enumerate(self.proposed_services)]

    def _generate_roadmap(self) -> RoadmapPlan:
        # Order services by coupling (outgoing cross-service edges): the least coupled
        # are extracted first, the most coupled last. Every service appears in exactly
        # one stage and no placeholder names are ever invented.
        def coupling(service: dict[str, Any]) -> int:
            metrics = service.get("metrics") or {}
            return int(metrics.get("external_edges_out") or 0) if isinstance(metrics, dict) else 0

        indexed = list(enumerate(self.proposed_services))
        indexed.sort(key=lambda pair: (coupling(pair[1]), pair[0]))
        names = [pair[1].get("name") or f"service-{pair[0]+1}" for pair in indexed]
        num_services = len(names)

        high_count = max(1, math.ceil(num_services * 0.25)) if num_services else 0
        high_risk = names[num_services - high_count:] if high_count else []
        rest = names[:num_services - high_count]
        low_risk = rest[:math.ceil(len(rest) / 2)]
        mid_risk = rest[math.ceil(len(rest) / 2):]

        recommended_pattern = "strangler_fig"
        if self.assumptions.risk_tolerance == "low" and num_services > 6:
            recommended_pattern = "modular_monolith"

        stages = [
            MigrationStage(
                stage_number=0,
                name="Preparation & Foundation",
                description="Establish API Gateway, core auth middleware, container registry, and CI/CD pipelines.",
                target_services=["API-Gateway-Infrastructure"],
                effort_estimate_weeks=2,
                rollout_method="direct",
                rollback_condition="Gateway infrastructure health checks fail",
                success_metric="100% gateway route coverage and baseline telemetry operating"
            ),
        ]
        if low_risk:
            stages.append(MigrationStage(
                stage_number=0,
                name="Low-Risk Service Extraction",
                description="Extract the least-coupled services first: few outgoing dependencies, so the lowest blast radius.",
                target_services=low_risk,
                effort_estimate_weeks=max(2, math.ceil(len(low_risk) * 1.5)),
                rollout_method="strangler_fig",
                rollback_condition="Latency spike > 200ms or HTTP 5xx error rate > 0.5%",
                success_metric="Zero downtime cutover with full shadow-traffic validation"
            ))
        if mid_risk:
            stages.append(MigrationStage(
                stage_number=0,
                name="Core Domain Extraction",
                description="Migrate moderately coupled domain services and introduce transactional outbox patterns.",
                target_services=mid_risk,
                effort_estimate_weeks=max(3, math.ceil(len(mid_risk) * 2.0)),
                rollout_method="strangler_fig",
                rollback_condition="Distributed transaction mismatch or DB replication lag > 2s",
                success_metric="99.99% data consistency verified across event boundary"
            ))
        if high_risk:
            stages.append(MigrationStage(
                stage_number=0,
                name="High-Coupling & Database Split",
                description="Extract the most coupled services last and decouple their shared monolith tables into isolated schemas.",
                target_services=high_risk,
                effort_estimate_weeks=max(4, math.ceil(len(high_risk) * 2.5)),
                rollout_method="blue_green",
                rollback_condition="Data integrity mismatch during dual-write verification",
                success_metric="Complete removal of direct database joins across service boundaries"
            ))
        stages.append(MigrationStage(
            stage_number=0,
            name="Stabilization & Monolith Retirement",
            description="Decommission monolithic routes and optimize microservice resource allocations.",
            target_services=["Legacy-Monolith-Decommission"],
            effort_estimate_weeks=2,
            rollout_method="direct",
            rollback_condition="Unmapped legacy route invocations detected in logs",
            success_metric="100% traffic served by microservices architecture"
        ))
        for number, stage in enumerate(stages, start=1):
            stage.stage_number = number

        total_duration = sum(s.effort_estimate_weeks for s in stages)

        return RoadmapPlan(
            pattern_recommended=recommended_pattern,
            total_duration_weeks=total_duration,
            stages=stages
        )

    def _generate_consistency_security(self) -> ConsistencySecurityMatrix:
        service_names = self._service_names()
        if len(service_names) < 2:
            return ConsistencySecurityMatrix(
                items=[],
                risk_summary="Only one service was proposed, so there are no cross-service boundaries to analyse."
            )

        items: list[ConsistencySecurityItem] = []

        for i in range(len(service_names) - 1):
            src = service_names[i]
            tgt = service_names[i + 1]

            is_sensitive = "auth" in src.lower() or "payment" in src.lower() or "user" in src.lower()
            items.append(
                ConsistencySecurityItem(
                    source_service=src,
                    target_service=tgt,
                    operation_type="write" if i % 2 == 0 else "read",
                    recommended_pattern="saga" if is_sensitive else ("outbox" if i % 2 == 0 else "direct"),
                    data_category="sensitive" if is_sensitive else "transactional",
                    encryption_required=is_sensitive,
                    audit_required=is_sensitive or i % 2 == 0
                )
            )

        summary = f"Identified {len(items)} cross-service boundaries requiring explicit consistency (Saga/Outbox) and zero-trust security parameters."

        return ConsistencySecurityMatrix(
            items=items,
            risk_summary=summary
        )

    def _generate_cost_performance(self) -> CostPerformanceSimulation:
        num_services = max(1, len(self.proposed_services))
        mult = self.assumptions.cost_multiplier
        provider = self.assumptions.cloud_provider.lower()

        provider_factor = 1.0
        if provider == "azure":
            provider_factor = 1.05
        elif provider == "gcp":
            provider_factor = 0.95

        base_monolith = 1200.0 * mult
        per_service_cost = 250.0 * provider_factor * mult
        base_infra = 400.0 * provider_factor * mult

        microservices_cost = (per_service_cost * num_services) + base_infra
        cost_min = microservices_cost * 0.85
        cost_max = microservices_cost * 1.30

        hop_latency = 4.5
        estimated_hops = min(4, math.ceil(num_services / 2))
        latency_increase = round(estimated_hops * hop_latency, 1)

        sensitivity_drivers = [
            f"Cloud Provider: {provider.upper()} ({self.assumptions.pricing_region})",
            f"Service Count: {num_services} independent containers",
            f"Infrastructure Scaling Multiplier: {mult}x",
            f"Network Inter-Service Hop Latency: ~{latency_increase}ms"
        ]

        return CostPerformanceSimulation(
            monolith_monthly_cost_usd=round(base_monolith, 2),
            microservices_monthly_cost_usd=round(microservices_cost, 2),
            cost_range_min_usd=round(cost_min, 2),
            cost_range_max_usd=round(cost_max, 2),
            avg_latency_increase_ms=latency_increase,
            sensitivity_drivers=sensitivity_drivers
        )

    def _generate_team_mapping(self) -> TeamMappingPlan:
        service_names = self._service_names()

        num_teams = max(1, self.assumptions.team_count)
        team_names = [f"Team {chr(65 + i)}" for i in range(num_teams)]

        assignments: list[TeamAssignment] = []
        for i, team in enumerate(team_names):
            assigned = [service_names[j] for j in range(len(service_names)) if j % num_teams == i]
            
            capacity = "optimal"
            spof = None
            if len(assigned) > 3:
                capacity = "overloaded"
                spof = f"{team} is assigned {len(assigned)} services, creating an organizational bottleneck."
            elif len(assigned) == 1:
                spof = f"{assigned[0]} relies on a single team without cross-training redundancy."

            assignments.append(
                TeamAssignment(
                    team_name=team,
                    assigned_services=assigned,
                    capacity_status=capacity,
                    spof_warning=spof
                )
            )

        return TeamMappingPlan(
            team_assignments=assignments,
            unassigned_services=[]
        )
