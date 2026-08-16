import asyncio
from db.pg_client import fetch
import json

async def main():
    revs = await fetch("SELECT * FROM scenario_revisions ORDER BY created_at DESC LIMIT 1")
    if revs:
        metrics = json.loads(revs[0]["metrics"])
        print("Total Clusters Created:", metrics.get("service_count"))
    else:
        print("No scenarios found.")

asyncio.run(main())
