"""
Offline test for the Postgres connection error hints.

    cd ai-service && .venv/bin/python scripts/test_pg_hint.py
"""
import os
import socket
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
for k, v in {"SUPABASE_URL": "http://x", "SUPABASE_SERVICE_ROLE_KEY": "x", "DATABASE_URL": "postgresql://u:p@h/db",
             "NEO4J_URI": "bolt://x", "NEO4J_USERNAME": "n", "NEO4J_PASSWORD": "x"}.items():
    os.environ.setdefault(k, v)

from db.pg_client import _connection_hint

direct = "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres"
pooler = "postgresql://postgres.abcdefgh:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

hint = _connection_hint(direct, socket.gaierror(8, "nodename nor servname provided"))
assert "IPv6" in hint and "Session pooler" in hint, hint

assert "password" in _connection_hint(pooler, Exception("password authentication failed for user")).lower()
assert "postgres.<project-ref>" in _connection_hint(pooler, Exception("Tenant or user not found"))
# a DNS failure on a pooler host must not blame the direct-connection IPv6 issue
assert "IPv6" not in _connection_hint(pooler, socket.gaierror(8, "x"))
print("postgres connection hints: all assertions passed")
