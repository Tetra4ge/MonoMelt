"""
Pydantic schemas for Phase 7 Architecture Blueprints & Export Packages.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID


class ArtifactFile(BaseModel):
    path: str
    sha256: str
    size_bytes: int
    content_type: str


class BlueprintManifest(BaseModel):
    generator_version: str = Field("1.0.0", description="Version of the blueprint generator")
    project_id: UUID
    scenario_revision_id: UUID
    plan_revision_id: UUID
    version_number: int
    artifacts: list[ArtifactFile] = Field(default_factory=list)
    input_provenance: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    validation_results: dict[str, bool] = Field(default_factory=dict)


class GenerateBlueprintRequest(BaseModel):
    project_id: UUID
    scenario_revision_id: UUID
    plan_revision_id: UUID
    version_number: int = 1
    proposed_services: list[dict[str, Any]] = Field(default_factory=list)
    roadmap_stages: list[dict[str, Any]] = Field(default_factory=list)
    consistency_security_items: list[dict[str, Any]] = Field(default_factory=list)
    cost_performance: Optional[dict[str, Any]] = None
    team_assignments: list[dict[str, Any]] = Field(default_factory=list)
    assumptions: Optional[dict[str, Any]] = None


class BlueprintResponse(BaseModel):
    success: bool
    manifest: BlueprintManifest
    blueprint_zip_base64: str
    # path -> text content of every generated file, for in-app preview
    files: dict[str, str] = Field(default_factory=dict)
