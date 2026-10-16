"""
Import Resolver
===============
Maps the raw import strings produced by the AST parser onto the files that
actually exist in the uploaded repository, so the graph gets real
File -> File IMPORTS edges.

Without this step every import ends up as an ExternalDependency edge: the
parser only knows the module *name* (`app.services.foo`, `./utils`), never
which uploaded file that refers to. Fan-in/fan-out, cycle detection,
clustering and the report's service-dependency view all depend on these
edges.

Resolution is repo-root agnostic. GitHub archives are prefixed with
`<repo>-<branch>/` and user ZIPs often have a wrapper folder, so absolute
Python imports are matched by path *suffix* rather than from a fixed root.

After resolution every ParsedImport falls into one of four states:
  - resolved_paths non-empty      -> internal edge to local file(s)
  - is_external=True              -> stdlib / third-party package
  - is_asset=True                 -> image, stylesheet, font or data file (ignored)
  - none of the above             -> unresolved local import (counted in metrics)
"""

from __future__ import annotations

import posixpath
import sys
from collections import defaultdict
from typing import Optional

from models.domain import ParsedFile, ParsedImport

_FALLBACK_STDLIB = {
    "os", "sys", "re", "json", "math", "io", "pathlib", "typing", "collections",
    "functools", "itertools", "datetime", "time", "logging", "unittest", "asyncio",
    "concurrent", "threading", "subprocess", "socket", "http", "urllib", "email",
    "xml", "csv", "hashlib", "hmac", "base64", "struct", "copy", "abc", "dataclasses",
    "enum", "contextlib", "warnings", "traceback", "inspect", "ast", "dis", "gc",
    "weakref", "platform", "shutil", "tempfile", "glob", "fnmatch", "pickle",
    "shelve", "sqlite3", "uuid", "random", "statistics", "decimal", "fractions",
    "array", "argparse", "string", "textwrap", "queue", "signal", "ssl", "zipfile",
}
STDLIB_MODULES: set[str] = set(getattr(sys, "stdlib_module_names", ())) or _FALLBACK_STDLIB

_JS_EXTS = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")
# Relative imports of these are bundler asset imports (`import logo from './logo.png'`), not code.
ASSET_EXTS = {
    ".css", ".scss", ".sass", ".less", ".styl",
    ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp3", ".mp4", ".webm", ".wav", ".ogg",
    ".json", ".md", ".mdx", ".txt", ".html", ".csv", ".yaml", ".yml", ".graphql", ".gql", ".wasm",
}
_JS_ESM_REWRITE = {".js": (".ts", ".tsx"), ".jsx": (".tsx",), ".mjs": (".mts",), ".cjs": (".cts",)}


def resolve_imports(parsed_files: list[ParsedFile]) -> None:
    """Resolve every import in-place. Safe to call on any parsed file list."""
    paths = {pf.file_path for pf in parsed_files}
    by_basename: dict[str, list[str]] = defaultdict(list)
    for path in paths:
        by_basename[posixpath.basename(path)].append(path)

    for pf in parsed_files:
        for imp in pf.imports:
            if pf.language == "python":
                _resolve_python(pf.file_path, imp, paths, by_basename)
            elif pf.language in ("javascript", "typescript"):
                _resolve_js(pf.file_path, imp, paths)


# ---------------------------------------------------------------------------
# Python
# ---------------------------------------------------------------------------

def _common_prefix_len(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a.split("/"), b.split("/")):
        if x != y:
            break
        n += 1
    return n


def _find_by_suffix(rel: str, by_basename: dict[str, list[str]], near_file: str) -> Optional[str]:
    hits = [p for p in by_basename.get(posixpath.basename(rel), []) if p == rel or p.endswith("/" + rel)]
    if not hits:
        return None
    near_dir = posixpath.dirname(near_file)
    hits.sort(key=lambda p: (-_common_prefix_len(p, near_dir), len(p)))
    return hits[0]


def _resolve_python(file_path: str, imp: ParsedImport, paths: set[str], by_basename: dict[str, list[str]]) -> None:
    module = imp.target_module
    level = len(module) - len(module.lstrip("."))
    parts = [p for p in module.lstrip(".").split(".") if p]

    found: list[str] = []

    if level > 0:
        base = posixpath.dirname(file_path)
        for _ in range(level - 1):
            base = posixpath.dirname(base)
        stem = posixpath.join(base, *parts) if parts else base

        for name in imp.names:
            for cand in (f"{stem}/{name}.py", f"{stem}/{name}/__init__.py"):
                cand = posixpath.normpath(cand).lstrip("/")
                if cand in paths:
                    found.append(cand)
                    break
        if not found:
            cands = [f"{stem}.py"] if parts else []
            cands.append(f"{stem}/__init__.py" if stem else "__init__.py")
            for cand in cands:
                cand = posixpath.normpath(cand).lstrip("/")
                if cand in paths:
                    found.append(cand)
                    break
    elif parts and parts[0] not in STDLIB_MODULES:
        stem = "/".join(parts)
        for name in imp.names:
            hit = _find_by_suffix(f"{stem}/{name}.py", by_basename, file_path) \
                or _find_by_suffix(f"{stem}/{name}/__init__.py", by_basename, file_path)
            if hit:
                found.append(hit)
        if not found:
            hit = _find_by_suffix(f"{stem}.py", by_basename, file_path) \
                or _find_by_suffix(f"{stem}/__init__.py", by_basename, file_path)
            if hit:
                found.append(hit)

    found = [p for p in dict.fromkeys(found) if p != file_path]
    imp.resolved_paths = found
    imp.resolved_path = found[0] if found else None
    # Relative imports are always local; absolute ones that did not match a
    # repo file are stdlib or third-party.
    imp.is_external = False if (found or level > 0) else True


# ---------------------------------------------------------------------------
# JavaScript / TypeScript
# ---------------------------------------------------------------------------

def _resolve_js(file_path: str, imp: ParsedImport, paths: set[str]) -> None:
    spec = imp.target_module
    if not (spec.startswith(".") or spec.startswith("/")):
        imp.is_external = True   # bare specifier: npm package or node: builtin
        imp.resolved_paths = []
        imp.resolved_path = None
        return

    if posixpath.splitext(spec)[1].lower() in ASSET_EXTS:
        # Not source code: not a graph edge and not an "unresolved import".
        imp.is_asset = True
        imp.is_external = False
        imp.resolved_paths = []
        imp.resolved_path = None
        return

    if spec.startswith("/"):
        joined = posixpath.normpath(spec.lstrip("/"))
    else:
        joined = posixpath.normpath(posixpath.join(posixpath.dirname(file_path), spec))

    candidates: list[str] = []
    if not joined.startswith(".."):
        stem, ext = posixpath.splitext(joined)
        candidates.append(joined)
        candidates.extend(joined + e for e in _JS_EXTS)
        candidates.extend(f"{joined}/index{e}" for e in _JS_EXTS)
        # TypeScript ESM style: import './foo.js' really means ./foo.ts
        for alt in _JS_ESM_REWRITE.get(ext, ()):
            candidates.append(stem + alt)

    found = next((c for c in candidates if c in paths and c != file_path), None)
    imp.resolved_paths = [found] if found else []
    imp.resolved_path = found
    imp.is_external = False
