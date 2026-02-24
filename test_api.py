import requests
import datetime
import uuid

def test():
    try:
        email = f"test_dashboard_{uuid.uuid4().hex[:8]}@test.com"
        password = "TestPassword123!"
        
        print("Registering...", email)
        res = requests.post('http://127.0.0.1:8000/auth/register', json={
            "email": email,
            "password": password,
            "full_name": "Tester",
            "role": "tenant"
        })
        res.raise_for_status()
        
        print("Logging in...")
        res = requests.post('http://127.0.0.1:8000/auth/login', data={
            "username": email,
            "password": password
        })
        res.raise_for_status()
        token = res.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        print("Fetching /auth/me ...")
        res = requests.get('http://127.0.0.1:8000/auth/me', headers=headers)
        res.raise_for_status()
        print("User data:", res.json()["email"])
        
        print("Fetching /auth/me/segment-config ...")
        res = requests.get('http://127.0.0.1:8000/auth/me/segment-config', headers=headers)
        res.raise_for_status()
        print("Segment Config:", res.json().get('segment'))
        
        print("Success!")
    except Exception as e:
        print("ERROR:", e)
        if hasattr(e, 'response') and e.response:
            print(e.response.text)

test()
