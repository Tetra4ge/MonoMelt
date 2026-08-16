import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath('.'))

from dotenv import load_dotenv
load_dotenv()

from services.enrichment import run_intelligence_pipeline
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    svid = "dfc384a4-1c09-4a36-b21d-490521b228b1"
    pid = "73bcf401-4bd0-4c3d-a0fa-21142938c045"
    oid = "c04e15ed-2e02-4af1-b92a-fb3bef15c3b3"
    
    print(f"Running intelligence pipeline locally for svid {svid}...")
    try:
        await run_intelligence_pipeline(
            project_id=pid,
            source_version_id=svid,
            owner_id=oid
        )
    except Exception as e:
        print("Crash:", e)

asyncio.run(main())
