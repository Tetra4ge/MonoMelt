"""
Metrics Calculator Service
==========================
Computes aggregate code metrics from the parsed files and the Neo4j graph.

Metrics computed:
  - File, line, symbol counts
  - Language breakdown
  - Fan-in / fan-out per file (from import edges)
  - Cycle detection (strongly connected components of the file import graph)
  - Centrality candidates (high fan-in files = decomposition boundary hints)
  - Unresolved imports count
  - Graph component count (disconnected sub-graphs)
"""

from __future__ import annotations

import logging
from collections import defaultdict

import networkx as nx
from models.domain import ParsedFile
from models.schemas import AggregateMetrics, FileMetric
from db.neo4j_client import run_query

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Local (in-memory) metrics from ParsedFile list
# ---------------------------------------------------------------------------

def compute_local_metrics(parsed_files: list[ParsedFile]) -> dict:
    """
    Fast in-memory metrics that don't need the graph DB.
    Called right after parsing, before the graph is written.
    """
    lang_breakdown: dict[str, int] = defaultdict(int)
    total_files = 0
    total_lines = 0
    total_functions = 0
    total_classes = 0
    unresolved_imports = 0

    for pf in parsed_files:
        if pf.language in ("python", "javascript", "typescript"):
            lang_breakdown[pf.language] += 1
            total_files += 1
            total_lines += pf.lines_of_code
            total_functions += sum(1 for s in pf.symbols if s.symbol_type in ("function", "method"))
            total_classes += sum(1 for s in pf.symbols if s.symbol_type == "class")
            # Count imports that could not be resolved to a local file
            unresolved_imports += sum(
                1 for imp in pf.imports
                if not imp.is_external and imp.resolved_path is None
            )

    return {
        "total_files": total_files,
        "total_lines": total_lines,
        "total_functions": total_functions,
        "total_classes": total_classes,
        "total_modules": total_files,  # 1:1 with parseable files in Phase 3
        "unresolved_imports": unresolved_imports,
        "language_breakdown": dict(lang_breakdown),
    }


# ---------------------------------------------------------------------------
# Graph metrics from Neo4j
# ---------------------------------------------------------------------------

async def compute_graph_metrics(
    source_version_id: str,
    project_id: str,
    owner_id: str,
    local_metrics: dict,
) -> AggregateMetrics:
    """
    Query Neo4j for graph-level metrics (fan-in, fan-out, cycles, components).
    Falls back to zeroed graph metrics if Neo4j is unreachable.
    """
    try:
        fan_out_data = await _get_fan_out(source_version_id, project_id, owner_id)
        fan_in_data  = await _get_fan_in(source_version_id, project_id, owner_id)
        cycle_count, components = await _file_graph_stats(source_version_id, project_id, owner_id)
        centrality   = await _top_centrality(source_version_id, project_id, owner_id)
    except Exception as exc:
        logger.warning("Graph metrics query failed: %s — using defaults", exc)
        fan_out_data = []
        fan_in_data  = []
        cycle_count  = 0
        components   = local_metrics["total_files"]
        centrality   = []

    top_fan_out = [
        FileMetric(
            file_path=r["file_path"],
            language=r.get("language", "unknown"),
            lines_of_code=r.get("lines_of_code", 0),
            num_functions=r.get("num_symbols", 0),
            num_classes=0,
            num_imports=r.get("fan_out", 0),
            fan_in=0,
            fan_out=r["fan_out"],
        )
        for r in fan_out_data[:10]
    ]

    top_fan_in = [
        FileMetric(
            file_path=r["file_path"],
            language=r.get("language", "unknown"),
            lines_of_code=r.get("lines_of_code", 0),
            num_functions=r.get("num_symbols", 0),
            num_classes=0,
            num_imports=0,
            fan_in=r["fan_in"],
            fan_out=0,
        )
        for r in fan_in_data[:10]
    ]

    from uuid import UUID
    return AggregateMetrics(
        source_version_id=UUID(source_version_id),
        total_files=local_metrics["total_files"],
        total_lines=local_metrics["total_lines"],
        total_functions=local_metrics["total_functions"],
        total_classes=local_metrics["total_classes"],
        total_modules=local_metrics["total_modules"],
        unresolved_imports=local_metrics["unresolved_imports"],
        cycle_count=cycle_count,
        graph_components=components,
        top_fan_in=top_fan_in,
        top_fan_out=top_fan_out,
        language_breakdown=local_metrics["language_breakdown"],
        centrality_candidates=[r.get("node_id", "") for r in centrality],
    )


# ---------------------------------------------------------------------------
# Cypher helpers
# ---------------------------------------------------------------------------

async def _get_fan_out(svid: str, pid: str, oid: str) -> list[dict]:
    """Files ranked by how many other files they import (fan-out)."""
    cypher = """
    MATCH (f:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
    OPTIONAL MATCH (f)-[:IMPORTS]->(dep)
    WITH f, count(dep) AS fan_out
    RETURN f.file_path AS file_path,
           f.language   AS language,
           f.lines_of_code AS lines_of_code,
           f.num_symbols   AS num_symbols,
           fan_out
    ORDER BY fan_out DESC
    LIMIT 20
    """
    return await run_query(cypher, {"svid": svid, "pid": pid, "oid": oid})


async def _get_fan_in(svid: str, pid: str, oid: str) -> list[dict]:
    """Files ranked by how many other files import them (fan-in)."""
    cypher = """
    MATCH (f:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
    OPTIONAL MATCH (importer)-[:IMPORTS]->(f)
    WITH f, count(importer) AS fan_in
    RETURN f.file_path    AS file_path,
           f.language     AS language,
           f.lines_of_code AS lines_of_code,
           f.num_symbols   AS num_symbols,
           fan_in
    ORDER BY fan_in DESC
    LIMIT 20
    """
    return await run_query(cypher, {"svid": svid, "pid": pid, "oid": oid})


async def _file_graph_stats(svid: str, pid: str, oid: str) -> tuple[int, int]:
    """
    Returns (cycle_count, graph_components) for the internal File -> File import graph.

    cycle_count: number of strongly connected components with more than one file
    (each is a set of files that transitively import each other), plus self-imports.
    graph_components: weakly connected components, i.e. independent clusters of files.
    """
    params = {"svid": svid, "pid": pid, "oid": oid}
    nodes = await run_query(
        "MATCH (f:File {source_version_id: $svid, project_id: $pid, owner_id: $oid}) RETURN f.node_id AS id",
        params,
    )
    edges = await run_query(
        """
        MATCH (a:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
              -[:IMPORTS]->(b:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
        RETURN a.node_id AS source, b.node_id AS target
        """,
        params,
    )

    graph = nx.DiGraph()
    graph.add_nodes_from(r["id"] for r in nodes)
    graph.add_edges_from((r["source"], r["target"]) for r in edges)

    cycles = sum(1 for comp in nx.strongly_connected_components(graph) if len(comp) > 1)
    cycles += nx.number_of_selfloops(graph)
    components = nx.number_weakly_connected_components(graph) if graph.number_of_nodes() else 0
    return cycles, components


async def _top_centrality(svid: str, pid: str, oid: str) -> list[dict]:
    """
    Approximate degree centrality: files with both high fan-in and fan-out
    are likely decomposition boundary candidates.
    """
    cypher = """
    MATCH (f:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
    OPTIONAL MATCH (f)-[:IMPORTS]->(out_dep)
    OPTIONAL MATCH (in_dep)-[:IMPORTS]->(f)
    WITH f,
         count(DISTINCT out_dep) AS fan_out,
         count(DISTINCT in_dep)  AS fan_in
    WHERE fan_in > 0 AND fan_out > 0
    RETURN f.node_id   AS node_id,
           f.file_path AS file_path,
           (fan_in + fan_out) AS degree
    ORDER BY degree DESC
    LIMIT 10
    """
    return await run_query(cypher, {"svid": svid, "pid": pid, "oid": oid})
