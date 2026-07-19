"""
AST Parser Service
==================
Parses source files into a normalised ParsedFile domain model.

Supported languages (Phase 3):
  - Python   → stdlib `ast` module (accurate)
  - JavaScript / TypeScript → regex-based heuristics (fast, good enough for
    import graph and symbol extraction without a full TS compiler)

Parser contract: detect → parse → extract → normalize → report_diagnostics

Unsupported files produce a ParsedFile with a diagnostic warning and empty
symbols/imports — the pipeline never fails because of one bad file.
"""

from __future__ import annotations

import ast
import re
import hashlib
import logging
from pathlib import Path
from typing import Optional

from models.domain import (
    ParsedFile,
    ParsedImport,
    ParsedSymbol,
    ExtractionMethod,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

_EXTENSION_MAP: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mjs": "javascript",
    ".cjs": "javascript",
}


def detect_language(file_path: str) -> Optional[str]:
    ext = Path(file_path).suffix.lower()
    return _EXTENSION_MAP.get(ext)


# ---------------------------------------------------------------------------
# Python parser
# ---------------------------------------------------------------------------

def _parse_python(file_path: str, source: str) -> ParsedFile:
    content_hash = hashlib.sha256(source.encode()).hexdigest()
    loc = len(source.splitlines())
    symbols: list[ParsedSymbol] = []
    imports: list[ParsedImport] = []
    diagnostics: list[dict] = []

    try:
        tree = ast.parse(source, filename=file_path)
    except SyntaxError as exc:
        diagnostics.append({
            "severity": "error",
            "parser": "python/ast",
            "message": f"SyntaxError: {exc.msg}",
            "line": exc.lineno,
            "column": exc.offset,
        })
        return ParsedFile(
            file_path=file_path,
            language="python",
            lines_of_code=loc,
            content_hash=content_hash,
            diagnostics=diagnostics,
        )

    for node in ast.walk(tree):
        # --- Symbols ---
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append(ParsedSymbol(
                name=node.name,
                symbol_type="function",
                start_line=node.lineno,
                end_line=node.end_lineno or node.lineno,
            ))
        elif isinstance(node, ast.ClassDef):
            symbols.append(ParsedSymbol(
                name=node.name,
                symbol_type="class",
                start_line=node.lineno,
                end_line=node.end_lineno or node.lineno,
            ))
            # Extract methods inside this class
            for child in ast.walk(node):
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child is not node:
                    symbols.append(ParsedSymbol(
                        name=child.name,
                        symbol_type="method",
                        start_line=child.lineno,
                        end_line=child.end_lineno or child.lineno,
                        parent=node.name,
                    ))

        # --- Imports ---
        elif isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(ParsedImport(
                    source_file=file_path,
                    target_module=alias.name,
                    is_external=_is_external_python(alias.name),
                    extraction_method=ExtractionMethod.STATIC,
                    line=node.lineno,
                ))
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(ParsedImport(
                    source_file=file_path,
                    target_module=node.module,
                    is_external=_is_external_python(node.module),
                    extraction_method=ExtractionMethod.STATIC,
                    line=node.lineno,
                ))

    return ParsedFile(
        file_path=file_path,
        language="python",
        lines_of_code=loc,
        content_hash=content_hash,
        symbols=symbols,
        imports=imports,
        diagnostics=diagnostics,
    )


def _is_external_python(module: str) -> bool:
    """Heuristic: relative imports (leading dot) or standard library are internal."""
    if not module:
        return False
    first_part = module.split(".")[0]
    # Standard library top-level names (non-exhaustive but covers common ones)
    _stdlib = {
        "os", "sys", "re", "json", "math", "io", "pathlib", "typing",
        "collections", "functools", "itertools", "datetime", "time",
        "logging", "unittest", "asyncio", "concurrent", "threading",
        "subprocess", "socket", "http", "urllib", "email", "xml",
        "csv", "hashlib", "hmac", "base64", "struct", "copy", "abc",
        "dataclasses", "enum", "contextlib", "warnings", "traceback",
        "inspect", "ast", "dis", "gc", "weakref", "platform", "shutil",
        "tempfile", "glob", "fnmatch", "pickle", "shelve", "sqlite3",
        "uuid", "random", "statistics", "decimal", "fractions", "array",
    }
    return first_part not in _stdlib


# ---------------------------------------------------------------------------
# JavaScript / TypeScript regex-based parser
# ---------------------------------------------------------------------------

# Match: import ... from 'mod'  |  import 'mod'
_JS_IMPORT_RE = re.compile(
    r"""import\s+(?:.*?\s+from\s+)?['"]([@\w./\-]+)['"]""",
    re.MULTILINE,
)
# Match: require('mod')
_JS_REQUIRE_RE = re.compile(
    r"""require\s*\(\s*['"]([@\w./\-]+)['"]\s*\)""",
    re.MULTILINE,
)
# Match: export default function name | export function name | export class name
_JS_EXPORT_FN_RE = re.compile(
    r"""export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)""",
    re.MULTILINE,
)
_JS_EXPORT_CLASS_RE = re.compile(
    r"""export\s+(?:default\s+)?class\s+(\w+)""",
    re.MULTILINE,
)
# Non-exported functions / classes
_JS_FN_RE = re.compile(
    r"""(?:^|\s)(?:async\s+)?function\s+(\w+)\s*\(""",
    re.MULTILINE,
)
_JS_ARROW_FN_RE = re.compile(
    r"""(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(""",
    re.MULTILINE,
)
_JS_CLASS_RE = re.compile(
    r"""(?:^|\s)class\s+(\w+)""",
    re.MULTILINE,
)


def _parse_js_ts(file_path: str, source: str, language: str) -> ParsedFile:
    content_hash = hashlib.sha256(source.encode()).hexdigest()
    loc = len(source.splitlines())
    symbols: list[ParsedSymbol] = []
    imports: list[ParsedImport] = []
    diagnostics: list[dict] = []

    lines = source.splitlines()

    def _line_of(match_start: int) -> int:
        return source[:match_start].count("\n") + 1

    # --- Imports ---
    for m in _JS_IMPORT_RE.finditer(source):
        mod = m.group(1)
        imports.append(ParsedImport(
            source_file=file_path,
            target_module=mod,
            is_external=not (mod.startswith(".") or mod.startswith("/")),
            extraction_method=ExtractionMethod.STATIC,
            line=_line_of(m.start()),
        ))

    for m in _JS_REQUIRE_RE.finditer(source):
        mod = m.group(1)
        imports.append(ParsedImport(
            source_file=file_path,
            target_module=mod,
            is_external=not (mod.startswith(".") or mod.startswith("/")),
            extraction_method=ExtractionMethod.INFERRED,
            line=_line_of(m.start()),
        ))

    # --- Symbols: classes ---
    seen_names: set[str] = set()
    for m in _JS_CLASS_RE.finditer(source):
        name = m.group(1)
        if name not in seen_names:
            seen_names.add(name)
            symbols.append(ParsedSymbol(
                name=name,
                symbol_type="class",
                start_line=_line_of(m.start()),
                end_line=_line_of(m.start()),
            ))

    # --- Symbols: functions ---
    for m in _JS_FN_RE.finditer(source):
        name = m.group(1)
        if name not in seen_names:
            seen_names.add(name)
            symbols.append(ParsedSymbol(
                name=name,
                symbol_type="function",
                start_line=_line_of(m.start()),
                end_line=_line_of(m.start()),
            ))

    for m in _JS_ARROW_FN_RE.finditer(source):
        name = m.group(1)
        if name not in seen_names:
            seen_names.add(name)
            symbols.append(ParsedSymbol(
                name=name,
                symbol_type="function",
                start_line=_line_of(m.start()),
                end_line=_line_of(m.start()),
            ))

    return ParsedFile(
        file_path=file_path,
        language=language,
        lines_of_code=loc,
        content_hash=content_hash,
        symbols=symbols,
        imports=imports,
        diagnostics=diagnostics,
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_file(file_path: str, source: str) -> ParsedFile:
    """
    Parse a single source file into the canonical ParsedFile model.
    Never raises — unsupported/broken files return a ParsedFile with diagnostics.
    """
    language = detect_language(file_path)

    if language == "python":
        return _parse_python(file_path, source)

    if language in ("javascript", "typescript"):
        return _parse_js_ts(file_path, source, language)

    # Unsupported language — record warning, return empty ParsedFile
    content_hash = hashlib.sha256(source.encode()).hexdigest()
    return ParsedFile(
        file_path=file_path,
        language=language or "unknown",
        lines_of_code=len(source.splitlines()),
        content_hash=content_hash,
        diagnostics=[{
            "severity": "warning",
            "parser": "none",
            "message": f"Language '{language or 'unknown'}' is not supported in Phase 3. File skipped.",
            "line": None,
            "column": None,
        }],
    )


def parse_files(files: list[dict]) -> list[ParsedFile]:
    """
    Parse a list of file dicts from the Phase 2 manifest.
    Each dict must have: file_path (str), source (str).
    """
    results = []
    for f in files:
        try:
            parsed = parse_file(f["file_path"], f.get("source", ""))
            results.append(parsed)
        except Exception as exc:
            logger.exception("Unexpected error parsing %s", f.get("file_path"))
            results.append(ParsedFile(
                file_path=f.get("file_path", "unknown"),
                language="unknown",
                lines_of_code=0,
                content_hash="",
                diagnostics=[{
                    "severity": "error",
                    "parser": "dispatcher",
                    "message": str(exc),
                    "line": None,
                    "column": None,
                }],
            ))
    return results
