import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath('.'))

from db.neo4j_client import get_driver, close_driver
from db.pg_client import fetch

async def main():
    scenario = await fetch("SELECT source_version_id FROM decomposition_scenarios LIMIT 1")
    svid = str(scenario[0]['source_version_id'])
    print("Checking neo4j for svid:", svid)
    
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run("MATCH (n {source_version_id: $svid}) RETURN count(n) as c", svid=svid)
        record = await result.single()
        print("Nodes found:", record["c"])
    await close_driver()

asyncio.run(main())
