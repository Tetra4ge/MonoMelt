"""
Offline test for the planning engine (no services needed).

    cd ai-service && .venv/bin/python scripts/test_planning_engine.py
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.planning_engine import PlanningEngine


def svc(name, coupling):
    return {"name": name, "metrics": {"external_edges_out": coupling}}


def names_in_plan(report):
    stage_targets = {t for st in report.roadmap.stages for t in st.target_services}
    teams = {n for t in report.team_mapping.team_assignments for n in t.assigned_services}
    pairs = {n for i in report.consistency_security.items for n in (i.source_service, i.target_service)}
    return stage_targets, teams, pairs


def main():
    infra = {"API-Gateway-Infrastructure", "Legacy-Monolith-Decommission"}

    for count in (1, 2, 3, 5, 9):
        services = [svc(f"svc-{i}", (i * 7) % 5) for i in range(count)]
        real = {s["name"] for s in services}
        report = PlanningEngine(services).generate_plan()
        stage_targets, teams, pairs = names_in_plan(report)

        assert stage_targets - infra == real, (count, stage_targets)           # every service planned, none invented
        assert teams == real and pairs <= real, (count, teams, pairs)
        extraction = [t for st in report.roadmap.stages for t in st.target_services if t not in infra]
        assert len(extraction) == len(set(extraction)) == count, extraction    # each service in exactly one stage
        assert [st.stage_number for st in report.roadmap.stages] == list(range(1, len(report.roadmap.stages) + 1))
        assert report.roadmap.total_duration_weeks == sum(st.effort_estimate_weeks for st in report.roadmap.stages)

    # the most coupled service is migrated last, the least coupled first
    report = PlanningEngine([svc("hub", 9), svc("leaf", 0), svc("mid", 3), svc("mid2", 4)]).generate_plan()
    order = [t for st in report.roadmap.stages for t in st.target_services if t not in infra]
    assert order[0] == "leaf" and order[-1] == "hub", order

    # a single service has no cross-service boundaries
    single = PlanningEngine([svc("only", 0)]).generate_plan()
    assert single.consistency_security.items == [] and "one service" in single.consistency_security.risk_summary

    print("planning engine: all assertions passed")


main()
