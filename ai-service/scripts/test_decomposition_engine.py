"""
Offline test for the decomposition engine's clustering (Neo4j/Postgres mocked).

    cd ai-service && .venv/bin/python scripts/test_decomposition_engine.py
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
for k, v in {"SUPABASE_URL": "http://x", "SUPABASE_SERVICE_ROLE_KEY": "x", "DATABASE_URL": "postgresql://u:p@h/db",
             "NEO4J_URI": "bolt://x", "NEO4J_USERNAME": "n", "NEO4J_PASSWORD": "x"}.items():
    os.environ.setdefault(k, v)

import services.decomposition_engine as eng

FILES = {
    "f1": "repo-main/src/billing/invoice.py", "f2": "repo-main/src/billing/tax.py", "f3": "repo-main/src/billing/pay.py",
    "f4": "repo-main/src/users/model.py", "f5": "repo-main/src/users/auth.py", "f6": "repo-main/src/users/profile.py",
    "f7": "repo-main/scripts/one.py", "f8": "repo-main/scripts/two.py",
}
EDGES = [("f1", "f2"), ("f2", "f3"), ("f3", "f1"), ("f4", "f5"), ("f5", "f6"), ("f6", "f4"), ("f1", "f4")]


async def fake_run_query(cypher, params=None, database=None):
    if "CONTAINS" in cypher:
        return [{"file_id": "f1", "symbol_id": "s1"}, {"file_id": "f4", "symbol_id": "s2"}]
    if "IMPORTS" in cypher:
        return [{"source": a, "target": b} for a, b in EDGES]
    return [{"id": k, "file_path": v} for k, v in FILES.items()]


async def build(strategy):
    e = eng.DecompositionEngine(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), strategy, owner_id=uuid.uuid4())
    await e._build_graph()
    return e.__class__._generate_proposed_services(e, e._cluster())


async def main():
    eng.run_query = fake_run_query
    for strategy in ("conservative", "aggressive", "default", "domain"):
        services = await build(strategy)
        names = [s["name"] for s in services]
        assert len(set(names)) == len(names), names                       # unique names
        assert all(n == n.lower() and "_" not in n and " " not in n for n in names), names
        covered = {n for s in services for n in s["assigned_nodes"] if n.startswith("f")}
        assert covered == set(FILES), (strategy, covered)                  # every file in exactly one service
        assert sum(1 for s in services for n in s["assigned_nodes"] if n.startswith("f")) == len(FILES)
        # f7+f8 have no imports: Louvain folds them into one shared service;
        # the domain strategy keeps them as their own `scripts/` package.
        leftover = "scripts-service" if strategy == "domain" else "shared-utilities"
        group = [s for s in services if s["name"] == leftover]
        assert len(group) == 1 and group[0]["metrics"]["file_count"] == 2, services
        if strategy in ("conservative", "default", "domain"):
            assert any(s["name"] == "billing-service" for s in services), names
        users = next(s for s in services if "s2" in s["assigned_nodes"])
        assert "f4" in users["assigned_nodes"]                             # symbols follow their file
        print(f"{strategy:13s} -> {names}")
    print("decomposition engine: all assertions passed")


REACT_FILES = {
    "r1": "chatverse-main/src/App.tsx", "r2": "chatverse-main/src/main.tsx",
    "c1": "chatverse-main/src/components/Chatbox.tsx", "c2": "chatverse-main/src/components/Message.tsx", "c3": "chatverse-main/src/components/Composer.tsx",
    "l1": "chatverse-main/src/components/Chatlist.tsx", "l2": "chatverse-main/src/components/ChatItem.tsx", "l3": "chatverse-main/src/components/Avatar.tsx",
    "s1": "chatverse-main/src/components/SettingsModal.tsx", "s2": "chatverse-main/src/components/ThemeToggle.tsx", "s3": "chatverse-main/src/components/Profile.tsx",
}
REACT_EDGES = [("r2", "r1"), ("r1", "c1"), ("r1", "l1"), ("r1", "s1"),
               ("c1", "c2"), ("c1", "c3"), ("c2", "c3"), ("l1", "l2"), ("l1", "l3"), ("l2", "l3"), ("s1", "s2"), ("s1", "s3"), ("s2", "s3")]


async def react_layout():
    """Several clusters inside one components/ folder must not all be called components-service."""
    global FILES, EDGES
    FILES, EDGES = REACT_FILES, REACT_EDGES
    for strategy in ("conservative", "aggressive"):
        services = await build(strategy)
        names = [s["name"] for s in services]
        assert len(set(names)) == len(names), names
        assert not any(n.startswith("components-service") for n in names), names     # named by what is in them
        assert not any("chatverse-main" in n for n in names), names                  # not by the zip wrapper folder
        assert not any(n.endswith(("-2", "-3", "-4")) for n in names), names         # no numeric de-dup suffixes needed
        print(f"react layout / {strategy:12s} -> {names}")
    domain = await build("domain")
    assert any(s["name"] == "components-service" for s in domain), [s["name"] for s in domain]   # folder strategy keeps folder names


async def run_all():
    await main()
    await react_layout()
    print("decomposition naming: all assertions passed")


asyncio.run(run_all())
