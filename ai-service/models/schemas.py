"""
Pydantic schemas for all API request/response validation.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID


# ---------------------------------------------------------------------------
# Trigger Analysis
# ---------------------------------------------------------------------------

class TriggerAnalysisRequest(BaseModel):
    source_version_id: UUID = Field(..., description="The source version to analyse")


class TriggerAnalysisResponse(BaseModel):
    success: bool
    analysis_run_id: UUID
    status: str
    message: str


# ---------------------------------------------------------------------------
# Analysis Run
# ---------------------------------------------------------------------------

class AnalysisRunStatus(BaseModel):
    analysis_run_id: UUID
    source_version_id: UUID
    project_id: UUID
    status: str   # pending | running | completed | failed
    parser_version: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]


# ---------------------------------------------------------------------------
# Graph nodes / edges
# ---------------------------------------------------------------------------

class GraphNode(BaseModel):
    id: str
    label: str          # File | Module | Class | Function | ExternalDependency
    name: str
    file_path: Optional[str] = None
    language: Optional[str] = None
    properties: dict[str, Any] = {}


class GraphEdge(BaseModel):
    source_id: str
    target_id: str
    relationship: str   # IMPORTS | CALLS | CONTAINS | DEPENDS_ON …
    confidence: float = 1.0
    extraction_method: str = "static"
    properties: dict[str, Any] = {}


class GraphResponse(BaseModel):
    source_version_id: UUID
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    total_nodes: int
    total_edges: int
    cursor: Optional[str] = None   # for pagination


# ---------------------------------------------------------------------------
# Code Metrics
# ---------------------------------------------------------------------------

class FileMetric(BaseModel):
    file_path: str
    language: str
    lines_of_code: int
    num_functions: int
    num_classes: int
    num_imports: int
    fan_in: int   # how many files import this
    fan_out: int  # how many files this imports


class AggregateMetrics(BaseModel):
    source_version_id: UUID
    total_files: int
    total_lines: int
    total_functions: int
    total_classes: int
    total_modules: int
    unresolved_imports: int
    cycle_count: int
    graph_components: int
    top_fan_in: list[FileMetric]
    top_fan_out: list[FileMetric]
    language_breakdown: dict[str, int]
    centrality_candidates: list[str]  # node IDs likely to be decomposition boundaries


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------

class ParserDiagnostic(BaseModel):
    file_path: str
    parser: str
    severity: str   # warning | error
    message: str
    line: Optional[int] = None
    column: Optional[int] = None


class DiagnosticsResponse(BaseModel):
    source_version_id: UUID
    total: int
    diagnostics: list[ParserDiagnostic]


# ---------------------------------------------------------------------------
# Decomposition
# ---------------------------------------------------------------------------

class TriggerDecompositionRequest(BaseModel):
    scenario_id: UUID
    project_id: UUID
    source_version_id: UUID
    strategy_type: str  # conservative | aggressive | domain | team
    owner_id: UUID

class TriggerDecompositionResponse(BaseModel):
    success: bool
    scenario_id: UUID
    status: str
    message: str

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    success: bool
    service: str
    status: str
    neo4j: str
    timestamp: datetime
