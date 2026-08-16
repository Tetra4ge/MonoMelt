import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath('.'))

from db.pg_client import fetch

async def main():
    f = await fetch('SELECT count(*) as c FROM ai_findings')
    print('Total findings:', f[0]['c'])

asyncio.run(main())
