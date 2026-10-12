"""
Agent 6 — Report Agent.

Aggregates the outputs of Agents 1-5 (Analysis, Intelligence, Decomposition,
Planning, Blueprint) into a single executive report.

Important: the proposed microservice boundaries (Agent 3 / Decomposition)
and the cost/risk/roadmap/team data (Agent 4 / Planning) are both persisted
in Postgres — `proposed_services` and `plan_revisions` respectively. Neo4j
only stores the raw file-level dependency graph (`:File`/`:Symbol` nodes and
`:IMPORTS` edges); there is no `:Microservice` node anywhere in the graph.
Neo4j is therefore used here only as a best-effort enrichment step, to work
out which proposed services depend on one another via the underlying file
imports, and a failure there must never take down report generation.
"""

import asyncio
import logging
from typing import Optional

from supabase import Client

from db.neo4j_client import get_driver
from models.reports import (
    CostAnalysis,
    DecompositionService,
    ExecutiveSummary,
    FinalReport,
    RiskAssessment,
)
from services.llm_provider import generate_content

logger = logging.getLogger(__name__)

# Used to convert the Planning Agent's week-based roadmap into months.
WEEKS_PER_MONTH = 4.345


class ReportAgent:
    def __init__(self, project_id: str, supabase_client: Client, owner_id: Optional[str] = None):
        self.project_id = project_id
        self.owner_id = owner_id
        self.supabase = supabase_client

    # ------------------------------------------------------------------
    # Postgres: latest migration plan revision (cost/risk/roadmap/teams)
    # ------------------------------------------------------------------
    def _fetch_plan_revision_sync(self) -> dict:
        plan_query = self.supabase.table('migration_plans').select('id').eq('project_id', self.project_id)
        if self.owner_id:
            plan_query = plan_query.eq('owner_id', self.owner_id)
        plan_res = plan_query.order('created_at', desc=True).limit(1).execute()

        if not plan_res.data:
            raise ValueError(f"No migration plan found for project {self.project_id}")

        plan_id = plan_res.data[0]['id']

        rev_res = self.supabase.table('plan_revisions') \
            .select('*') \
            .eq('plan_id', plan_id) \
            .order('revision_number', desc=True) \
            .limit(1) \
            .execute()

        if not rev_res.data:
            raise ValueError(f"No completed planning data found for project {self.project_id}")

        return rev_res.data[0]

    async def _fetch_postgres_context(self) -> dict:
        """Runs the blocking Supabase lookup in a worker thread so it can
        genuinely run concurrently alongside the decomposition fetch."""
        return await asyncio.to_thread(self._fetch_plan_revision_sync)

    # ------------------------------------------------------------------
    # Postgres: proposed microservices from the Decomposition Agent
    # ------------------------------------------------------------------
    def _fetch_decomposition_sync(self) -> tuple[list[dict], Optional[str]]:
        """Returns (proposed_services rows, source_version_id) for the most
        recent decomposition scenario belonging to this project/owner."""
        scenario_query = self.supabase.table('decomposition_scenarios') \
            .select('id, source_version_id') \
            .eq('project_id', self.project_id)
        if self.owner_id:
            scenario_query = scenario_query.eq('owner_id', self.owner_id)
        scenario_res = scenario_query.order('created_at', desc=True).limit(1).execute()

        if not scenario_res.data:
            return [], None

        scenario = scenario_res.data[0]

        rev_res = self.supabase.table('scenario_revisions') \
            .select('id') \
            .eq('scenario_id', scenario['id']) \
            .order('revision_number', desc=True) \
            .limit(1) \
            .execute()

        if not rev_res.data:
            return [], scenario.get('source_version_id')

        revision_id = rev_res.data[0]['id']

        services_res = self.supabase.table('proposed_services') \
            .select('*') \
            .eq('revision_id', revision_id) \
            .execute()

        return services_res.data or [], scenario.get('source_version_id')

    async def _fetch_decomposition_context(self) -> tuple[list[dict], Optional[str]]:
        return await asyncio.to_thread(self._fetch_decomposition_sync)

    # ------------------------------------------------------------------
    # Neo4j: best-effort cross-service dependency enrichment
    # ------------------------------------------------------------------
    async def _fetch_service_dependencies(
        self, services: list[dict], source_version_id: Optional[str]
    ) -> dict[str, list[str]]:
        """
        Looks up IMPORTS edges between files assigned to different proposed
        services, scoped by source_version_id/project_id/owner_id (per the
        tenant-isolation rule in db/neo4j_client.py), to infer which services
        depend on which. AuraDB's free tier is known to idle-disconnect, so
        any failure here degrades to "no known dependencies" instead of
        failing the whole report.
        """
        empty = {s['name']: [] for s in services}
        if not source_version_id or not services:
            return empty

        node_to_service: dict[str, str] = {}
        for service in services:
            for node_id in service.get('assigned_nodes') or []:
                node_to_service[node_id] = service['name']

        if not node_to_service:
            return empty

        cypher = """
            MATCH (a {source_version_id: $svid, project_id: $pid, owner_id: $oid})
                  -[:IMPORTS]->
                  (b {source_version_id: $svid, project_id: $pid, owner_id: $oid})
            RETURN a.node_id AS source, b.node_id AS target
        """
        try:
            driver = get_driver()
            async with driver.session() as session:
                result = await session.run(
                    cypher,
                    svid=source_version_id, pid=self.project_id, oid=self.owner_id,
                )
                records = await result.data()
        except Exception as e:
            logger.warning(f"Skipping cross-service dependency lookup (Neo4j unavailable): {e}")
            return empty

        deps: dict[str, set] = {s['name']: set() for s in services}
        for record in records:
            src_service = node_to_service.get(record['source'])
            tgt_service = node_to_service.get(record['target'])
            if src_service and tgt_service and src_service != tgt_service:
                deps[src_service].add(tgt_service)

        return {name: sorted(targets) for name, targets in deps.items()}

    # ------------------------------------------------------------------
    # LLM: executive summary
    # ------------------------------------------------------------------
    async def _generate_executive_summary(self, raw_data: dict) -> str:
        """Prompts the LLM to write a business-facing summary of the technical data."""
        prompt = f"""
        Act as a Principal Cloud Architect. Review the following microservice decomposition data:
        Total Services: {raw_data.get('total_services')}
        Cost Multiplier: {raw_data.get('cost_multiplier')}

        Write a concise, 2-paragraph executive summary explaining the business impact of this migration.
        """
        try:
            response = await generate_content(prompt)
            return response.text
        except Exception as e:
            logger.warning(f"Executive summary generation failed: {e}")
            return (
                "Executive summary generation failed due to AI provider timeout. "
                "Please review the raw metrics below."
            )

    # ------------------------------------------------------------------
    # Mapping helpers.
    #
    # The Planning/Decomposition agents persist their own domain schemas
    # (see models/planning.py and the `proposed_services` table), and those
    # field names do not line up 1:1 with the report's output schema. Each
    # domain is translated explicitly here rather than via `Model(**data)`,
    # which would raise a validation error on every real row.
    # ------------------------------------------------------------------
    @staticmethod
    def _map_cost_analysis(cost_data: dict) -> Optional[CostAnalysis]:
        if not cost_data:
            return None
        monolith = cost_data.get('monolith_monthly_cost_usd')
        micro = cost_data.get('microservices_monthly_cost_usd')
        if monolith is None or micro is None:
            return None
        multiplier = round(micro / monolith, 2) if monolith else 0.0
        return CostAnalysis(
            current_monolith_cost_monthly=monolith,
            projected_microservices_cost_monthly=micro,
            infrastructure_multiplier=multiplier,
            breakdown={
                "cost_range_min_usd": cost_data.get('cost_range_min_usd', 0.0),
                "cost_range_max_usd": cost_data.get('cost_range_max_usd', 0.0),
                "avg_latency_increase_ms": cost_data.get('avg_latency_increase_ms', 0.0),
            },
        )

    @staticmethod
    def _map_risk_assessment(risk_data: dict, team_mapping: dict) -> Optional[RiskAssessment]:
        if not risk_data:
            return None
        items = risk_data.get('items') or []

        critical_paths = [
            f"{i['source_service']} -> {i['target_service']}"
            for i in items
            if i.get('data_category') == 'sensitive' or i.get('encryption_required')
        ]
        data_consistency_flags = [
            f"{i['source_service']} -> {i['target_service']}: requires {i['recommended_pattern']}"
            for i in items
            if i.get('operation_type') == 'write' and i.get('recommended_pattern') in ('saga', 'outbox', 'cqrs')
        ]

        mitigation_strategies = []
        summary = risk_data.get('risk_summary')
        if summary:
            mitigation_strategies.append(summary)
        for team in (team_mapping or {}).get('team_assignments') or []:
            if team.get('spof_warning'):
                mitigation_strategies.append(team['spof_warning'])
        if not mitigation_strategies:
            mitigation_strategies.append("No mitigation strategy generated.")

        return RiskAssessment(
            critical_paths=critical_paths,
            data_consistency_flags=data_consistency_flags,
            mitigation_strategies=mitigation_strategies,
        )

    @staticmethod
    def _overall_risk_score(risk_data: dict) -> str:
        items = (risk_data or {}).get('items') or []
        if not items:
            return 'UNKNOWN'
        sensitive = sum(
            1 for i in items if i.get('data_category') == 'sensitive' or i.get('encryption_required')
        )
        ratio = sensitive / len(items)
        if ratio > 0.4:
            return 'HIGH'
        if ratio > 0.15:
            return 'MEDIUM'
        return 'LOW'

    @staticmethod
    def _estimated_timeline_months(roadmap: dict) -> int:
        weeks = (roadmap or {}).get('total_duration_weeks')
        if not weeks:
            return 0
        return max(1, round(weeks / WEEKS_PER_MONTH))

    @staticmethod
    def _team_allocation(service_name: str, team_mapping: dict) -> int:
        """1 if this service has an owning team assigned, 0 otherwise.
        The Planning Agent's team_mapping does not track engineer headcount,
        so this reports assignment status rather than a fabricated number."""
        for team in (team_mapping or {}).get('team_assignments') or []:
            if service_name in (team.get('assigned_services') or []):
                return 1
        return 0

    # ------------------------------------------------------------------
    # Orchestration
    # ------------------------------------------------------------------
    async def build_report(self) -> FinalReport:
        """Orchestrates the fan-out query and builds the Pydantic model."""
        # 1. Fetch the planning context and decomposition context concurrently.
        plan_data, (services, source_version_id) = await asyncio.gather(
            self._fetch_postgres_context(),
            self._fetch_decomposition_context(),
        )

        # 2. Best-effort cross-service dependency enrichment from Neo4j.
        dependencies_by_service = await self._fetch_service_dependencies(services, source_version_id)

        # 3. Extract specific domains from the plan revision payload.
        cost_data = plan_data.get('cost_performance') or {}
        risk_data = plan_data.get('consistency_security') or {}
        roadmap = plan_data.get('roadmap') or {}
        team_mapping = plan_data.get('team_mapping') or {}

        cost_analysis = self._map_cost_analysis(cost_data)

        # 4. Generate LLM Summary
        summary_text = await self._generate_executive_summary({
            "total_services": len(services),
            "cost_multiplier": cost_analysis.infrastructure_multiplier if cost_analysis else 0,
        })

        # 5. Construct Pydantic Model
        report = FinalReport(
            project_id=self.project_id,
            executive_summary=ExecutiveSummary(
                total_services_extracted=len(services),
                overall_risk_score=self._overall_risk_score(risk_data),
                estimated_timeline_months=self._estimated_timeline_months(roadmap),
                business_impact=summary_text,
            ),
            decomposition_strategy=[
                DecompositionService(
                    service_name=s['name'],
                    rationale=s.get('description') or '',
                    dependencies=dependencies_by_service.get(s['name'], []),
                    team_allocation=self._team_allocation(s['name'], team_mapping),
                )
                for s in services
            ],
            cost_analysis=cost_analysis,
            risk_assessment=self._map_risk_assessment(risk_data, team_mapping),
        )

        return report
