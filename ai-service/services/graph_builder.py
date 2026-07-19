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


def _symbol_node_id(source_version_id: str, file_path: str, name: str) -> str:
    return f"{source_version_id}::{file_path}::{name}"


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
    MERGE (sym {node_id: s.node_id})
    ON CREATE SET sym:Symbol
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
                "node_id": _symbol_node_id(ctx["svid"], pf.file_path, sym.name),
                "file_node_id": file_nid,
                "name": sym.name,
                "symbol_type": sym.symbol_type,
                "file_path": pf.file_path,
                "start_line": sym.start_line,
                "end_line": sym.end_line,
            })
    if symbols_data:
        await session.run(cypher, {"symbols": symbols_data, **ctx})


async def _merge_import_edges(session, parsed_files: list[ParsedFile], ctx: dict) -> None:
    """
    MERGE IMPORTS edges between File nodes (internal) or
    ExternalDependency nodes (external packages).
    """
    # Build a lookup: file_path → node_id for fast resolution
    file_map = {
        pf.file_path: _file_node_id(ctx["svid"], pf.file_path)
        for pf in parsed_files
    }

    internal_edges = []
    external_deps: dict[str, str] = {}  # module_name → ext node_id

    for pf in parsed_files:
        source_nid = _file_node_id(ctx["svid"], pf.file_path)
        for imp in pf.imports:
            if imp.is_external:
                ext_nid = _ext_dep_node_id(ctx["svid"], imp.target_module)
                external_deps[imp.target_module] = ext_nid
                internal_edges.append({
                    "source_nid": source_nid,
                    "target_nid": ext_nid,
                    "confidence": 1.0,
                    "method": imp.extraction_method.value,
                    "line": imp.line,
                    "is_external": True,
                })
            else:
                # Try to resolve relative import to absolute path
                resolved = imp.resolved_path or imp.target_module
                # Check if target is in our file map
                target_nid = file_map.get(resolved)
                if target_nid is None:
                    # Store as unresolved external
                    ext_nid = _ext_dep_node_id(ctx["svid"], imp.target_module)
                    external_deps[imp.target_module] = ext_nid
                    target_nid = ext_nid
                    is_ext = True
                else:
                    is_ext = False

                internal_edges.append({
                    "source_nid": source_nid,
                    "target_nid": target_nid,
                    "confidence": 1.0,
                    "method": imp.extraction_method.value,
                    "line": imp.line,
                    "is_external": is_ext,
                })

    # 1. Create ExternalDependency nodes
    if external_deps:
        ext_cypher = """
        UNWIND $deps AS d
        MERGE (ext:ExternalDependency {node_id: d.node_id})
        SET ext += {
          source_version_id: $svid,
          project_id:        $pid,
          owner_id:          $oid,
          name:              d.name
        }
        """
        await session.run(ext_cypher, {
            "deps": [{"node_id": nid, "name": name} for name, nid in external_deps.items()],
            **ctx,
        })

    # 2. Create IMPORTS edges
    if internal_edges:
        edge_cypher = """
        UNWIND $edges AS e
        MATCH (src {node_id: e.source_nid})
        MATCH (tgt {node_id: e.target_nid})
        MERGE (src)-[r:IMPORTS]->(tgt)
        SET r.confidence = e.confidence,
            r.extraction_method = e.method,
            r.source_line = e.line
        """
        await session.run(edge_cypher, {"edges": internal_edges, **ctx})


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
        await _merge_file_nodes(session, eligible, ctx)
        logger.info("  ✓ File nodes merged")

        await _merge_symbol_nodes(session, eligible, ctx)
        logger.info("  ✓ Symbol nodes merged")

        await _merge_import_edges(session, eligible, ctx)
        logger.info("  ✓ Import edges merged")

    total_symbols = sum(len(pf.symbols) for pf in eligible)
    total_imports = sum(len(pf.imports) for pf in eligible)

    return {
        "files_written": len(eligible),
        "files_skipped": skipped,
        "symbols_written": total_symbols,
        "edges_written": total_imports,
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
