import subprocess
import time
import requests
import os
import signal

def capture_error():
    # Start uvicorn in the background
    cmd = ["uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"]
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    
    print("Starting server on port 8001...")
    proc = subprocess.Popen(
        cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        text=True,
        env=env,
        cwd="."
    )
    
    # Wait for server to start
    time.sleep(3)
    
    print("Attempting registration...")
    try:
        resp = requests.post(
            "http://127.0.0.1:8001/auth/register",
            json={
                "email": "debug_test@test.com",
                "password": "SecurePass123!",
                "full_name": "Debug User",
                "role": "tenant"
            },
            timeout=5
        )
        print(f"Response Status: {resp.status_code}")
        print(f"Response Body: {resp.text}")
    except Exception as e:
        print(f"Request failed: {e}")
    
    # Wait a bit for logs to flush
    time.sleep(2)
    
    # Stop the server
    os.kill(proc.pid, signal.SIGTERM)
    
    # Read the output
    stdout, _ = proc.communicate()
    print("\n--- SERVER LOGS ---")
    print(stdout)

if __name__ == "__main__":
    capture_error()
