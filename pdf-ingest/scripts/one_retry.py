#!/usr/bin/env python3
import requests
import sys

PLACEHOLDER_ID = "3b6891d6-fc56-434a-b8f1-45658a258dbb"
URL = "http://web:8000/api/v1/convex-persist-retry"
TIMEOUT = 30

def main():
    try:
        resp = requests.post(URL, json={"placeholderId": PLACEHOLDER_ID}, timeout=TIMEOUT)
        print("HTTP", resp.status_code)
        try:
            print(resp.json())
        except Exception:
            print(resp.text)
    except Exception as e:
        print("ERROR", repr(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
