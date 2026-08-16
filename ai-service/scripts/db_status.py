import asyncio
from db.pg_client import fetch
import json

async def main():
    scenarios = await fetch("SELECT * FROM decomposition_scenarios")
    for s in scenarios:
        print(s["id"], s["status"])

asyncio.run(main())
