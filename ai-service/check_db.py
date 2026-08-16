import asyncio
from db.pg_client import fetch
import json

async def main():
    runs = await fetch("SELECT * FROM analysis_runs ORDER BY created_at DESC LIMIT 1")
    if runs:
        print("Latest Run ID:", runs[0]["id"])
        print("Status:", runs[0]["status"])
        print("Error:", runs[0].get("error_message"))
        print("Graph Summary:", runs[0].get("graph_summary"))
        sv_id = runs[0]["source_version_id"]
        files = await fetch("SELECT count(*) FROM source_files WHERE source_version_id = $1", sv_id)
        print("Files in manifest for SV:", files[0]["count"])
        
        metrics = await fetch("SELECT * FROM code_metrics WHERE source_version_id = $1", sv_id)
        if metrics:
            print("Metrics Total Files:", metrics[0]["total_files"])
            print("Metrics Total Lines:", metrics[0]["total_lines"])
        else:
            print("No metrics found.")
    else:
        print("No runs found.")

asyncio.run(main())
