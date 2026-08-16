import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath('.'))

from db.pg_client import execute

async def main():
    await execute("DELETE FROM decomposition_scenarios")
    print("Cleared all stuck scenarios!")

asyncio.run(main())
