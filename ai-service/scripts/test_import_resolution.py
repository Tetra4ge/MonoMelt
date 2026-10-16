"""
Offline regression test for the parser + import resolver (no databases needed).

    cd ai-service && .venv/bin/python scripts/test_import_resolution.py
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.ast_parser import parse_files
from services.import_resolver import resolve_imports

REPO = {
    # GitHub-style wrapper folder: absolute imports must still resolve.
    "repo-main/app/__init__.py": "",
    "repo-main/app/main.py": (
        "import os\nimport requests\n"
        "from app.services import billing\n"
        "from app.services.users import get_user\n"
        "from . import config\n"
        "from .models import User\n"
    ),
    "repo-main/app/config.py": "SETTING = 1\n",
    "repo-main/app/models.py": (
        "class User:\n    def __init__(self):\n        pass\n    def save(self):\n        pass\n"
        "class Order:\n    def __init__(self):\n        pass\n"
    ),
    "repo-main/app/services/__init__.py": "",
    "repo-main/app/services/billing.py": "from ..models import Order\n",
    "repo-main/app/services/users.py": "from app.models import User\ndef get_user():\n    pass\n",
    "web/src/index.ts": (
        "import {\n  a,\n  b\n} from './lib/util';\n"
        "import React from 'react';\n"
        "export * from './components';\n"
        "const lazy = () => import('./pages/home.js');\n"
        "const fs = require('node:fs');\n"
    ),
    "web/src/lib/util.ts": "export const a = 1; export const b = 2;\n",
    "web/src/components/index.tsx": "export const C = () => null;\n",
    "web/src/pages/home.ts": "import { a } from '../lib/util';\n",
    "web/src/main.tsx": "import './index.css';\nimport logo from './assets/logo.png';\nimport data from './data.json';\nimport { a } from './lib/util';\n",
}


def targets(parsed, path):
    pf = next(p for p in parsed if p.file_path == path)
    return {tp for imp in pf.imports for tp in imp.resolved_paths}


def main() -> None:
    parsed = parse_files([{"file_path": p, "source": s} for p, s in REPO.items()])
    resolve_imports(parsed)

    main_t = targets(parsed, "repo-main/app/main.py")
    assert main_t == {
        "repo-main/app/services/billing.py",
        "repo-main/app/services/users.py",
        "repo-main/app/config.py",
        "repo-main/app/models.py",
    }, main_t

    assert targets(parsed, "repo-main/app/services/billing.py") == {"repo-main/app/models.py"}
    assert targets(parsed, "repo-main/app/services/users.py") == {"repo-main/app/models.py"}

    main_pf = next(p for p in parsed if p.file_path == "repo-main/app/main.py")
    stdlib_or_pkg = {i.target_module: i.is_external for i in main_pf.imports if not i.resolved_paths}
    assert stdlib_or_pkg == {"os": True, "requests": True}, stdlib_or_pkg

    idx = targets(parsed, "web/src/index.ts")
    assert idx == {"web/src/lib/util.ts", "web/src/components/index.tsx", "web/src/pages/home.ts"}, idx
    assert targets(parsed, "web/src/pages/home.ts") == {"web/src/lib/util.ts"}
    ext = {i.target_module for i in next(p for p in parsed if p.file_path == "web/src/index.ts").imports if i.is_external}
    assert ext == {"react", "node:fs"}, ext

    models_pf = next(p for p in parsed if p.file_path == "repo-main/app/models.py")
    names = [(s.name, s.symbol_type) for s in models_pf.symbols]
    assert names.count(("__init__", "method")) == 2 and ("__init__", "function") not in names, names
    assert len(models_pf.symbols) == 5, names  # 2 classes + 3 methods, no duplicates

    # asset imports (css, images, json) are neither dependencies nor unresolved code imports
    main_pf = next(p for p in parsed if p.file_path == "web/src/main.tsx")
    assets = {i.target_module for i in main_pf.imports if i.is_asset}
    assert assets == {"./index.css", "./assets/logo.png", "./data.json"}, assets
    assert targets(parsed, "web/src/main.tsx") == {"web/src/lib/util.ts"}

    unresolved = sum(1 for p in parsed for i in p.imports if not i.is_external and not i.is_asset and not i.resolved_paths)
    assert unresolved == 0, unresolved

    print("import resolution: all assertions passed")


if __name__ == "__main__":
    main()
