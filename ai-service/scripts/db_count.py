import asyncio
from db.pg_client import fetch
import json

async def main():
    scenarios = await fetch("SELECT * FROM decomposition_scenarios")
    print("Scenarios:", len(scenarios))
    revs = await fetch("SELECT * FROM scenario_revisions")
    print("Revisions:", len(revs))
    runs = await fetch("SELECT * FROM analysis_runs")
    print("Analysis Runs:", len(runs))

asyncio.run(main())
