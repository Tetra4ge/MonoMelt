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

    _collect_python_symbols(tree, symbols, None)

    for node in ast.walk(tree):
        # --- Imports ---
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(ParsedImport(
                    source_file=file_path,
                    target_module=alias.name,
                    is_external=True,   # provisional; import_resolver decides
                    extraction_method=ExtractionMethod.STATIC,
                    line=node.lineno,
                ))
        elif isinstance(node, ast.ImportFrom):
            if node.module or node.level:
                # Keep the relative level as leading dots (`from ..x import y` -> "..x")
                imports.append(ParsedImport(
                    source_file=file_path,
                    target_module="." * node.level + (node.module or ""),
                    is_external=node.level == 0,
                    extraction_method=ExtractionMethod.STATIC,
                    line=node.lineno,
                    names=[a.name for a in node.names if a.name != "*"],
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


def _collect_python_symbols(node: ast.AST, symbols: list[ParsedSymbol], parent_class: Optional[str]) -> None:
    """
    Walk the tree once, tagging each function as a method (directly inside a
    class body) or a function. A plain ast.walk would report every method
    twice - once as a function and once as a method.
    """
    for child in ast.iter_child_nodes(node):
        if isinstance(child, ast.ClassDef):
            symbols.append(ParsedSymbol(
                name=child.name,
                symbol_type="class",
                start_line=child.lineno,
                end_line=child.end_lineno or child.lineno,
                parent=parent_class,
            ))
            _collect_python_symbols(child, symbols, child.name)
        elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append(ParsedSymbol(
                name=child.name,
                symbol_type="method" if parent_class else "function",
                start_line=child.lineno,
                end_line=child.end_lineno or child.lineno,
                parent=parent_class,
            ))
            _collect_python_symbols(child, symbols, None)
        else:
            _collect_python_symbols(child, symbols, parent_class)


# ---------------------------------------------------------------------------
# JavaScript / TypeScript regex-based parser
# ---------------------------------------------------------------------------

# Match: import ... from 'mod'  |  import 'mod'
# [^'";]*? lets the binding list span several lines (`import {\n a,\n b\n} from 'x'`).
_JS_IMPORT_RE = re.compile(
    r"""(?:^|[\s;])import\s+(?:[^'";]*?\s+from\s+)?['"]([^'"\n]+)['"]""",
    re.MULTILINE,
)
# Match: export * from 'mod' | export { a } from 'mod'
_JS_EXPORT_FROM_RE = re.compile(
    r"""export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"\n]+)['"]""",
    re.MULTILINE,
)
# Match: import('mod')
_JS_DYNAMIC_IMPORT_RE = re.compile(
    r"""\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)""",
    re.MULTILINE,
)
# Match: require('mod')
_JS_REQUIRE_RE = re.compile(
    r"""require\s*\(\s*['"]([^'"\n]+)['"]\s*\)""",
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

    for m in _JS_EXPORT_FROM_RE.finditer(source):
        mod = m.group(1)
        imports.append(ParsedImport(
            source_file=file_path,
            target_module=mod,
            is_external=not (mod.startswith(".") or mod.startswith("/")),
            extraction_method=ExtractionMethod.STATIC,
            line=_line_of(m.start()),
        ))

    for pattern in (_JS_REQUIRE_RE, _JS_DYNAMIC_IMPORT_RE):
        for m in pattern.finditer(source):
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
