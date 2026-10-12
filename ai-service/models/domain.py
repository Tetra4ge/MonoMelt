"""
Internal domain classes and enums used within service layer.
These are NOT exposed to the API — schemas.py handles that.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class NodeLabel(str, Enum):
    REPOSITORY = "Repository"
    DIRECTORY = "Directory"
    FILE = "File"
    MODULE = "Module"
    CLASS = "Class"
    FUNCTION = "Function"
    METHOD = "Method"
    ROUTE = "Route"
    DATABASE_TABLE = "DatabaseTable"
    EXTERNAL_DEPENDENCY = "ExternalDependency"


class EdgeType(str, Enum):
    CONTAINS = "CONTAINS"
    IMPORTS = "IMPORTS"
    CALLS = "CALLS"
    EXPOSES = "EXPOSES"
    READS = "READS"
    WRITES = "WRITES"
    QUERIES = "QUERIES"
    DEPENDS_ON = "DEPENDS_ON"


class ExtractionMethod(str, Enum):
    STATIC = "static"     # definitive — resolved via AST
    INFERRED = "inferred" # likely — e.g. dynamic require()


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ParsedSymbol:
    """One function, class, or method extracted from a file."""
    name: str
    symbol_type: str   # "function" | "class" | "method"
    start_line: int
    end_line: int
    parent: Optional[str] = None   # class name if method


@dataclass
class ParsedImport:
    """One import/require statement extracted from a file."""
    source_file: str         # file that has the import
    target_module: str       # what is being imported (raw string)
    resolved_path: Optional[str] = None   # first resolved local file, if any
    is_external: bool = False             # True for stdlib / node_modules / PyPI
    extraction_method: ExtractionMethod = ExtractionMethod.STATIC
    line: int = 0
    names: list[str] = field(default_factory=list)          # `from x import a, b` -> [a, b]
    resolved_paths: list[str] = field(default_factory=list)  # every local file this import points to


@dataclass
class ParsedFile:
    """Normalised output from one file's parser run."""
    file_path: str
    language: str
    lines_of_code: int
    content_hash: str
    symbols: list[ParsedSymbol] = field(default_factory=list)
    imports: list[ParsedImport] = field(default_factory=list)
    diagnostics: list[dict] = field(default_factory=list)  # warnings/errors
    parser_version: str = "1.0"


@dataclass
class AnalysisContext:
    """Passed through the entire pipeline for one analysis run."""
    analysis_run_id: str
    project_id: str
    source_version_id: str
    owner_id: str
    files: list[ParsedFile] = field(default_factory=list)
