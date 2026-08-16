import logging
import networkx as nx
from community import community_louvain
import uuid
import json

from db.neo4j_client import get_driver
from db.pg_client import get_pg_connection

logger = logging.getLogger(__name__)

class DecompositionEngine:
    def __init__(self, scenario_id: uuid.UUID, project_id: uuid.UUID, source_version_id: uuid.UUID, strategy_type: str):
        self.scenario_id = scenario_id
        self.project_id = project_id
        self.source_version_id = source_version_id
        self.strategy_type = strategy_type
        self.graph = nx.DiGraph()

    async def run(self):
        try:
            logger.info(f"Starting decomposition for scenario {self.scenario_id} using {self.strategy_type}")
            
            # 1. Fetch graph from Neo4j
            await self._build_graph()
            
            # 2. Run clustering strategy
            clusters = await self._run_clustering()
            
            # 3. Calculate metrics and format output
            proposed_services = self._generate_proposed_services(clusters)
            
            # 4. Save to PostgreSQL
            await self._save_results(proposed_services)
            
            logger.info(f"Successfully completed decomposition for scenario {self.scenario_id}")
            
        except Exception as e:
            logger.error(f"Decomposition failed: {e}")
            await self._mark_failed(str(e))

    async def _build_graph(self):
        driver = get_driver()
        query = """
        MATCH (n {source_version_id: $svid})
        OPTIONAL MATCH (n)-[r]->(m {source_version_id: $svid})
        RETURN n.node_id AS source, labels(n)[0] AS source_label, n.name AS source_name,
               m.node_id AS target, type(r) AS rel_type
        """
        async with driver.session() as session:
            result = await session.run(query, svid=str(self.source_version_id))
            records = await result.data()
            
            for record in records:
                source = record["source"]
                if not self.graph.has_node(source):
                    self.graph.add_node(source, label=record["source_label"], name=record["source_name"])
                
                target = record["target"]
                if target:
                    # We add an edge. Weight can be adjusted based on rel_type if needed.
                    self.graph.add_edge(source, target, type=record["rel_type"], weight=1.0)
                    if not self.graph.has_node(target):
                        # The target node should be picked up by the MATCH n, but just in case
                        self.graph.add_node(target)

    async def _run_clustering(self):
        # Louvain works on undirected graphs
        undirected_graph = self.graph.to_undirected()
        
        # Determine resolution based on strategy
        resolution = 1.0
        if self.strategy_type == "conservative":
            resolution = 0.5  # Fewer, larger clusters
        elif self.strategy_type == "aggressive":
            resolution = 2.0  # More, smaller clusters
        elif self.strategy_type == "domain":
            # For domain, we could ideally seed it with ai_findings.
            # For simplicity in this engine pass, we will run standard louvain with a balanced resolution,
            # but in a real enterprise app, we'd pre-assign nodes based on domain text matching.
            resolution = 1.0
        else:
            resolution = 1.0
            
        # Run Louvain
        # partition is a dict: { node_id: community_id }
        partition = community_louvain.best_partition(undirected_graph, resolution=resolution, weight='weight')
        
        # Group by community
        clusters = {}
        for node, comm_id in partition.items():
            if comm_id not in clusters:
                clusters[comm_id] = []
            clusters[comm_id].append(node)
            
        return clusters

    def _generate_proposed_services(self, clusters: dict) -> list:
        services = []
        for comm_id, nodes in clusters.items():
            # Calculate simple metrics for this cluster
            internal_edges = 0
            external_edges = 0
            
            for u in nodes:
                for _, v in self.graph.out_edges(u):
                    if v in nodes:
                        internal_edges += 1
                    else:
                        external_edges += 1
            
            # Cohesion: internal connections / total possible or total actual
            # Coupling: external connections
            
            services.append({
                "name": f"Service_{comm_id + 1}",
                "description": f"Auto-generated cluster with {len(nodes)} components.",
                "assigned_nodes": nodes,
                "metrics": {
                    "node_count": len(nodes),
                    "internal_edges": internal_edges,
                    "external_edges_out": external_edges
                }
            })
            
        return services

    async def _save_results(self, proposed_services: list):
        conn = await get_pg_connection()
        try:
            async with conn.transaction():
                # 1. Create a revision
                rev_id = uuid.uuid4()
                await conn.execute(
                    """
                    INSERT INTO scenario_revisions (id, scenario_id, revision_number, metrics)
                    VALUES ($1, $2, 1, $3)
                    """,
                    rev_id, self.scenario_id, json.dumps({"service_count": len(proposed_services)})
                )
                
                # 2. Insert proposed services
                for srv in proposed_services:
                    await conn.execute(
                        """
                        INSERT INTO proposed_services (revision_id, name, description, assigned_nodes, metrics)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        rev_id, srv["name"], srv["description"], json.dumps(srv["assigned_nodes"]), json.dumps(srv["metrics"])
                    )
                
                # 3. Update scenario status
                await conn.execute(
                    "UPDATE decomposition_scenarios SET status = 'completed', updated_at = timezone('utc', now()) WHERE id = $1",
                    self.scenario_id
                )
        finally:
            await conn.close()

    async def _mark_failed(self, error_msg: str):
        conn = await get_pg_connection()
        try:
            await conn.execute(
                "UPDATE decomposition_scenarios SET status = 'failed', updated_at = timezone('utc', now()) WHERE id = $1",
                self.scenario_id
            )
        finally:
            await conn.close()
