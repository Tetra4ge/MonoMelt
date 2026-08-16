import requests

def main():
    payload = {
        "scenario_id": "11344db5-4282-4bda-a84d-abefb04eee4f", 
        "project_id": "9ee9ae44-61af-457c-a085-1fe68906afaa", 
        "source_version_id": "7198c176-bc9c-41a8-bd3b-d0c0843d5093", 
        "strategy_type": "conservative"
    }
    try:
        r = requests.post("http://localhost:8000/decomposition/generate", json=payload)
        print("Status:", r.status_code)
        print("Body:", r.text)
    except Exception as e:
        print("Exception:", e)

main()
