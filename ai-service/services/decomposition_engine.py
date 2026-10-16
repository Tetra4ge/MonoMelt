"""
Decomposition Engine (Agent 3)
==============================
Splits the file-level import graph into proposed microservices.

Only internal File -> File IMPORTS edges are clustered. External packages
are excluded on purpose: a package like `react` is imported everywhere and
would glue unrelated files into one giant community. Symbols are not
clustered either; each symbol simply follows the file that contains it.

Strategies:
  conservative - Louvain, low resolution  (fewer, larger services)
  aggressive   - Louvain, high resolution (more, smaller services)
  domain       - group by package/directory structure (bounded contexts
                 usually follow the folder layout)
  default      - Louvain, balanced resolution
"""

import json
import logging
import posixpath
import re
import uuid
from collections import Counter, defaultdict

import networkx as nx
from community import community_louvain

from db.neo4j_client import run_query
from db.pg_client import get_pg_connection

logger = logging.getLogger(__name__)

RESOLUTIONS = {"conservative": 0.5, "aggressive": 2.0}
# Folder names that carry no domain meaning when naming/grouping services.
GENERIC_DIRS = {"src", "app", "lib", "source", "main", "core", "pkg", "internal", "packages", "apps"}
# Folders that group by *kind* of file rather than by business meaning. A cluster living in
# `components/` is better named after its most connected file than after `components`.
CONTAINER_DIRS = {"components", "component", "utils", "util", "helpers", "common", "shared", "hooks", "types", "assets", "styles"}
SHARED_SERVICE_NAME = "shared-utilities"


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "service"


class DecompositionEngine:
    def __init__(
        self,
        scenario_id: uuid.UUID,
        project_id: uuid.UUID,
        source_version_id: uuid.UUID,
        strategy_type: str,
        owner_id: uuid.UUID | str | None = None,
    ):
        self.scenario_id = scenario_id
        self.project_id = project_id
        self.source_version_id = source_version_id
        self.owner_id = owner_id
        self.strategy_type = strategy_type
        self.graph = nx.DiGraph()
        self.file_paths: dict[str, str] = {}          # file node_id -> file_path
        self.symbols_by_file: dict[str, list[str]] = defaultdict(list)
        self._shared_group: set[str] = set()

    async def run(self):
        try:
            logger.info(f"Starting decomposition for scenario {self.scenario_id} using {self.strategy_type}")
            await self._build_graph()
            clusters = self._cluster()
            proposed_services = self._generate_proposed_services(clusters)
            await self._save_results(proposed_services)
            logger.info(f"Successfully completed decomposition for scenario {self.scenario_id}")
        except Exception as e:
            logger.error(f"Decomposition failed: {e}", exc_info=True)
            await self._mark_failed(str(e))

    # ------------------------------------------------------------------
    # Graph loading (tenant-scoped)
    # ------------------------------------------------------------------
    async def _build_graph(self):
        scope = {"svid": str(self.source_version_id), "pid": str(self.project_id), "oid": str(self.owner_id)}

        files = await run_query(
            """
            MATCH (f:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
            RETURN f.node_id AS id, f.file_path AS file_path
            """,
            scope,
        )
        if not files:
            raise ValueError("No analysed files found for this source version. Run the analysis first.")

        for row in files:
            self.file_paths[row["id"]] = row["file_path"]
            self.graph.add_node(row["id"])

        edges = await run_query(
            """
            MATCH (a:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
                  -[:IMPORTS]->(b:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})
            RETURN a.node_id AS source, b.node_id AS target
            """,
            scope,
        )
        for row in edges:
            if row["source"] != row["target"]:
                self.graph.add_edge(row["source"], row["target"], weight=1.0)

        symbols = await run_query(
            """
            MATCH (f:File {source_version_id: $svid, project_id: $pid, owner_id: $oid})-[:CONTAINS]->(s:Symbol)
            RETURN f.node_id AS file_id, s.node_id AS symbol_id
            """,
            scope,
        )
        for row in symbols:
            self.symbols_by_file[row["file_id"]].append(row["symbol_id"])

    # ------------------------------------------------------------------
    # Clustering
    # ------------------------------------------------------------------
    def _cluster(self) -> list[list[str]]:
        if self.strategy_type == "domain":
            groups = self._cluster_by_directory()
        else:
            resolution = RESOLUTIONS.get(self.strategy_type, 1.0)
            partition = community_louvain.best_partition(
                self.graph.to_undirected(), resolution=resolution, weight="weight", random_state=42
            )
            by_community: dict[int, list[str]] = defaultdict(list)
            for node, community in partition.items():
                by_community[community].append(node)
            groups = list(by_community.values())

        return self._fold_isolated(groups)

    def _cluster_by_directory(self) -> list[list[str]]:
        """Group files by their first meaningful directory below the repo root."""
        common = self._common_depth()
        groups: dict[str, list[str]] = defaultdict(list)
        for nid, path in self.file_paths.items():
            meaningful = self._meaningful_dirs(path, common)
            groups[meaningful[0] if meaningful else SHARED_SERVICE_NAME].append(nid)
        return list(groups.values())

    def _fold_isolated(self, groups: list[list[str]]) -> list[list[str]]:
        """
        Louvain puts every file with no internal imports in its own community,
        which would otherwise become hundreds of one-file 'services'. Gather
        those into a single shared-utilities service.
        """
        kept: list[list[str]] = []
        isolated: list[str] = []
        for group in groups:
            if len(group) == 1 and self.graph.degree(group[0]) == 0:
                isolated.extend(group)
            else:
                kept.append(group)
        if len(isolated) == 1:
            kept.append(isolated)
        elif isolated:
            kept.append(isolated)
            self._shared_group = set(isolated)
        return kept

    # ------------------------------------------------------------------
    # Service generation
    # ------------------------------------------------------------------
    def _common_depth(self) -> int:
        """Number of leading directories shared by every file (e.g. the `repo-main/` wrapper)."""
        dirs = [posixpath.dirname(p).split("/") if posixpath.dirname(p) else [] for p in self.file_paths.values()]
        if not dirs:
            return 0
        common, shortest = 0, min(len(d) for d in dirs)
        while common < shortest and len({d[common] for d in dirs}) == 1:
            common += 1
        return common

    def _meaningful_dirs(self, path: str, common: int) -> list[str]:
        parts = posixpath.dirname(path).split("/") if posixpath.dirname(path) else []
        return [p for p in parts[common:] if p and p.lower() not in GENERIC_DIRS]

    def _service_label(self, files: list[str], common: int) -> str:
        """
        Name a service after what it is about. Prefer the dominant business folder; for
        clusters that sit in a kind-of-file folder (components/, utils/) or in the repo root,
        use the stem of their most connected file instead, so sibling clusters in the same
        folder do not all end up called `components-service`.
        """
        counts: Counter = Counter()
        for nid in files:
            dirs = self._meaningful_dirs(self.file_paths[nid], common)
            if dirs:
                counts[dirs[-1]] += 1
        folder = counts.most_common(1)[0][0] if counts else None

        if folder and (self.strategy_type == "domain" or folder.lower() not in CONTAINER_DIRS):
            return _slug(folder)

        # Hub file: most import connections, ties broken by path for determinism.
        hub = max(files, key=lambda nid: (self.graph.degree(nid), self.file_paths[nid]))
        stem = posixpath.splitext(posixpath.basename(self.file_paths[hub]))[0]
        return _slug(stem)

    def _generate_proposed_services(self, clusters: list[list[str]]) -> list[dict]:
        shared = self._shared_group

        used_names: set[str] = set()
        services = []
        common = self._common_depth()
        for idx, files in enumerate(sorted(clusters, key=lambda g: (-len(g), min(self.file_paths[n] for n in g)))):
            is_shared = bool(shared) and set(files) == shared
            base = SHARED_SERVICE_NAME if is_shared else f"{self._service_label(files, common)}-service"
            name, n = base, 2
            while name in used_names:
                name, n = f"{base}-{n}", n + 1
            used_names.add(name)

            file_set = set(files)
            internal = external = 0
            for u in files:
                for v in self.graph.successors(u):
                    if v in file_set:
                        internal += 1
                    else:
                        external += 1

            assigned = list(files)
            for nid in files:
                assigned.extend(self.symbols_by_file.get(nid, []))

            services.append({
                "name": name,
                "description": (
                    f"Shared files with no internal dependencies ({len(files)} files)."
                    if is_shared else
                    f"{len(files)} files grouped by {'package structure' if self.strategy_type == 'domain' else 'import coupling'}."
                ),
                "assigned_nodes": assigned,
                "metrics": {
                    "node_count": len(assigned),
                    "file_count": len(files),
                    "internal_edges": internal,
                    "external_edges_out": external,
                },
            })
        return services

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    async def _save_results(self, proposed_services: list):
        total_internal = sum(s["metrics"]["internal_edges"] for s in proposed_services)
        total_cross = sum(s["metrics"]["external_edges_out"] for s in proposed_services)
        conn = await get_pg_connection()
        try:
            async with conn.transaction():
                rev_id = uuid.uuid4()
                await conn.execute(
                    """
                    INSERT INTO scenario_revisions (id, scenario_id, revision_number, metrics)
                    VALUES ($1, $2, 1, $3)
                    """,
                    rev_id, self.scenario_id,
                    json.dumps({
                        "service_count": len(proposed_services),
                        "internal_edges": total_internal,
                        "cross_service_edges": total_cross,
                    }),
                )

                for srv in proposed_services:
                    await conn.execute(
                        """
                        INSERT INTO proposed_services (revision_id, name, description, assigned_nodes, metrics)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        rev_id, srv["name"], srv["description"], json.dumps(srv["assigned_nodes"]), json.dumps(srv["metrics"])
                    )

                await conn.execute(
                    "UPDATE decomposition_scenarios SET status = 'completed', updated_at = timezone('utc', now()) WHERE id = $1",
                    self.scenario_id
                )
        finally:
            await conn.close()

    async def _mark_failed(self, error_msg: str):
        logger.error("Scenario %s failed: %s", self.scenario_id, error_msg)
        try:
            conn = await get_pg_connection()
            try:
                await conn.execute(
                    "UPDATE decomposition_scenarios SET status = 'failed', updated_at = timezone('utc', now()) WHERE id = $1",
                    self.scenario_id
                )
            finally:
                await conn.close()
        except Exception:
            logger.exception("Could not mark scenario %s as failed", self.scenario_id)
