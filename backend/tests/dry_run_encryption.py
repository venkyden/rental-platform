import json
import base64
import hashlib
from cryptography.fernet import Fernet

# Manual mock of the logic
SECRET_KEY = "test_secret_key"
h = hashlib.sha256(SECRET_KEY.encode()).digest()
key = base64.urlsafe_b64encode(h).decode()
fernet = Fernet(key.encode())

def encrypt(data):
    json_str = json.dumps(data)
    return fernet.encrypt(json_str.encode()).decode()

def decrypt(encrypted_str):
    decrypted_data = fernet.decrypt(encrypted_str.encode())
    return json.loads(decrypted_data.decode())

# Test data
test_data = {"passport": "ABC123456", "status": "verified"}
encrypted = encrypt(test_data)
print(f"Encrypted: {encrypted[:20]}...")
assert "ABC123456" not in encrypted

decrypted = decrypt(encrypted)
print(f"Decrypted: {decrypted}")
assert decrypted == test_data

print("✅ Dry-run Encryption Logic Verified")
