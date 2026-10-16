"""
Graph Builder Service
=====================
Takes the list of ParsedFile objects from the AST parser and writes a
versioned dependency graph to Neo4j using idempotent MERGE statements.

Tenant isolation: every node is tagged with owner_id, project_id, and
source_version_id. Queries in this module always include all three so that
no data from one tenant is ever visible to another.

Node uniqueness key: (source_version_id, file_path) for File nodes,
                     (source_version_id, file_path, name) for symbols,
                     (source_version_id, name) for ExternalDependency.
"""

from __future__ import annotations

import logging
from uuid import UUID
from models.domain import ParsedFile, NodeLabel, EdgeType, ExtractionMethod
from db.neo4j_client import get_session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _file_node_id(source_version_id: str, file_path: str) -> str:
    return f"{source_version_id}::{file_path}"


def _symbol_node_id(source_version_id: str, file_path: str, name: str, start_line: int) -> str:
    # start_line keeps same-named symbols apart (every class has an __init__).
    return f"{source_version_id}::{file_path}::{name}:{start_line}"


def _ext_dep_node_id(source_version_id: str, module: str) -> str:
    return f"{source_version_id}::ext::{module}"


# ---------------------------------------------------------------------------
# Node writers
# ---------------------------------------------------------------------------

async def _merge_file_nodes(session, parsed_files: list[ParsedFile], ctx: dict) -> None:
    """MERGE one File node per parsed file."""
    cypher = """
    UNWIND $files AS f
    MERGE (file:File {node_id: f.node_id})
    SET file += {
      source_version_id: $svid,
      project_id:        $pid,
      owner_id:          $oid,
      file_path:         f.file_path,
      language:          f.language,
      lines_of_code:     f.lines_of_code,
      content_hash:      f.content_hash,
      num_symbols:       f.num_symbols,
      num_imports:       f.num_imports
    }
    """
    files_data = [
        {
            "node_id": _file_node_id(ctx["svid"], pf.file_path),
            "file_path": pf.file_path,
            "language": pf.language,
            "lines_of_code": pf.lines_of_code,
            "content_hash": pf.content_hash,
            "num_symbols": len(pf.symbols),
            "num_imports": len(pf.imports),
        }
        for pf in parsed_files
    ]
    await session.run(cypher, {"files": files_data, **ctx})


async def _merge_symbol_nodes(session, parsed_files: list[ParsedFile], ctx: dict) -> None:
    """MERGE Function/Class/Method nodes and link them to their File."""
    cypher = """
    UNWIND $symbols AS s
    MERGE (sym:Symbol {node_id: s.node_id})
    SET sym += {
      source_version_id: $svid,
      project_id:        $pid,
      owner_id:          $oid,
      name:              s.name,
      symbol_type:       s.symbol_type,
      file_path:         s.file_path,
      start_line:        s.start_line,
      end_line:          s.end_line
    }
    WITH sym, s
    MATCH (file:File {node_id: s.file_node_id})
    MERGE (file)-[:CONTAINS]->(sym)
    """
    symbols_data = []
    for pf in parsed_files:
        file_nid = _file_node_id(ctx["svid"], pf.file_path)
        for sym in pf.symbols:
            symbols_data.append({
                "node_id": _symbol_node_id(ctx["svid"], pf.file_path, sym.name, sym.start_line),
                "file_node_id": file_nid,
                "name": sym.name,
                "symbol_type": sym.symbol_type,
                "file_path": pf.file_path,
                "start_line": sym.start_line,
                "end_line": sym.end_line,
            })
    if symbols_data:
        await session.run(cypher, {"symbols": symbols_data, **ctx})


async def _merge_import_edges(session, parsed_files: list[ParsedFile], ctx: dict) -> dict:
    """
    MERGE IMPORTS edges: File -> File for imports that resolved to an uploaded
    file, File -> ExternalDependency for stdlib / third-party / unresolved ones.
    Returns edge counts for the run summary.
    """
    internal_edges: dict[tuple[str, str], dict] = {}
    external_edges: dict[tuple[str, str], dict] = {}
    external_deps: dict[str, str] = {}  # module_name -> ext node_id

    for pf in parsed_files:
        source_nid = _file_node_id(ctx["svid"], pf.file_path)
        for imp in pf.imports:
            if imp.is_asset:
                continue  # images, styles and data files are not dependencies
            method = imp.extraction_method.value
            if imp.resolved_paths:
                for target_path in imp.resolved_paths:
                    key = (source_nid, _file_node_id(ctx["svid"], target_path))
                    if key[0] != key[1]:
                        internal_edges.setdefault(key, {"method": method, "line": imp.line})
            else:
                ext_nid = _ext_dep_node_id(ctx["svid"], imp.target_module)
                external_deps[imp.target_module] = ext_nid
                external_edges.setdefault((source_nid, ext_nid), {"method": method, "line": imp.line})

    if external_deps:
        await session.run("""
        UNWIND $deps AS d
        MERGE (ext:ExternalDependency {node_id: d.node_id})
        SET ext += {
          source_version_id: $svid,
          project_id:        $pid,
          owner_id:          $oid,
          name:              d.name
        }
        """, {
            "deps": [{"node_id": nid, "name": name} for name, nid in external_deps.items()],
            **ctx,
        })

    def _rows(edges: dict) -> list[dict]:
        return [
            {"source_nid": src, "target_nid": tgt, "method": v["method"], "line": v["line"]}
            for (src, tgt), v in edges.items()
        ]

    # Labelled MATCH on both ends so the node_id indexes are used.
    if internal_edges:
        await session.run("""
        UNWIND $edges AS e
        MATCH (src:File {node_id: e.source_nid})
        MATCH (tgt:File {node_id: e.target_nid})
        MERGE (src)-[r:IMPORTS]->(tgt)
        SET r.confidence = 1.0, r.extraction_method = e.method, r.source_line = e.line
        """, {"edges": _rows(internal_edges), **ctx})

    if external_edges:
        await session.run("""
        UNWIND $edges AS e
        MATCH (src:File {node_id: e.source_nid})
        MATCH (tgt:ExternalDependency {node_id: e.target_nid})
        MERGE (src)-[r:IMPORTS]->(tgt)
        SET r.confidence = 1.0, r.extraction_method = e.method, r.source_line = e.line
        """, {"edges": _rows(external_edges), **ctx})

    return {"internal_edges": len(internal_edges), "external_edges": len(external_edges)}


async def ensure_indexes(session) -> None:
    """node_id lookups run for every MERGE/MATCH above; index them (idempotent)."""
    for label in ("File", "Symbol", "ExternalDependency"):
        await session.run(
            f"CREATE INDEX {label.lower()}_node_id IF NOT EXISTS FOR (n:{label}) ON (n.node_id)"
        )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def build_graph(
    parsed_files: list[ParsedFile],
    analysis_run_id: str,
    project_id: str,
    source_version_id: str,
    owner_id: str,
) -> dict:
    """
    Write the full dependency graph to Neo4j for one source version.
    Returns a summary of what was written.
    """
    ctx = {
        "svid": source_version_id,
        "pid":  project_id,
        "oid":  owner_id,
    }

    # Only process files that have parseable content
    eligible = [pf for pf in parsed_files if pf.language in ("python", "javascript", "typescript")]
    skipped = len(parsed_files) - len(eligible)

    logger.info(
        "Building graph for source_version=%s: %d eligible files, %d skipped",
        source_version_id, len(eligible), skipped,
    )

    async with get_session() as session:
        await ensure_indexes(session)
        await _merge_file_nodes(session, eligible, ctx)
        logger.info("  ✓ File nodes merged")

        await _merge_symbol_nodes(session, eligible, ctx)
        logger.info("  ✓ Symbol nodes merged")

        edge_counts = await _merge_import_edges(session, eligible, ctx)
        logger.info("  ✓ Import edges merged")

    total_symbols = sum(len(pf.symbols) for pf in eligible)

    return {
        "files_written": len(eligible),
        "files_skipped": skipped,
        "symbols_written": total_symbols,
        "edges_written": edge_counts["internal_edges"] + edge_counts["external_edges"],
        "internal_edges": edge_counts["internal_edges"],
        "external_edges": edge_counts["external_edges"],
    }


async def delete_graph(source_version_id: str, project_id: str, owner_id: str) -> None:
    """
    Remove all nodes for a given source version — called on re-analysis.
    Scoped strictly to the owner's source version.
    """
    cypher = """
    MATCH (n {source_version_id: $svid, project_id: $pid, owner_id: $oid})
    DETACH DELETE n
    """
    async with get_session() as session:
        await session.run(cypher, {
            "svid": source_version_id,
            "pid":  project_id,
            "oid":  owner_id,
        })
    logger.info("Deleted graph for source_version=%s", source_version_id)
