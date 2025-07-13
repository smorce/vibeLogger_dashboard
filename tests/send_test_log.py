import json
import sys
import uuid
from datetime import datetime, timezone

import requests

# -----------------------------------------------------------------------------
# USAGE:
#   python send_test_log.py                # -> POST to http://127.0.0.1:6702
#   python send_test_log.py http://host:port
# -----------------------------------------------------------------------------

def main():
    server = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:6702"
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": "INFO",
        "operation": "data_sync",
        "message": "Data sync started",
        "context": {"run_id": str(uuid.uuid4()), "prompt": "prompt_send_test"},
        "project": "external_project",
    }

    print("POST", server + "/api/ingest")
    res = requests.post(
        server + "/api/ingest",
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload, ensure_ascii=False),
        timeout=10,
    )
    print("Status:", res.status_code)
    try:
        print("Response:", res.json())
    except Exception:
        print("Response text:", res.text)


if __name__ == "__main__":
    main() 