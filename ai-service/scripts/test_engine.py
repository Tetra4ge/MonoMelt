import asyncio
import uuid
import sys
import logging

# Ensure src root is in path so we can import modules
import os
sys.path.insert(0, os.path.abspath('.'))

from services.decomposition_engine import DecompositionEngine
from db.pg_client import fetch

logging.basicConfig(level=logging.INFO)

async def main():
    scenario = await fetch("SELECT * FROM decomposition_scenarios LIMIT 1")
    if not scenario:
        print("No scenarios in DB to test.")
        return
        
    s = scenario[0]
    
    engine = DecompositionEngine(
        scenario_id=s['id'],
        project_id=s['project_id'],
        source_version_id=s['source_version_id'],
        strategy_type=s['strategy_type']
    )
    
    print("Running engine directly...")
    try:
        await engine.run()
    except Exception as e:
        print("Crash:", e)

asyncio.run(main())
