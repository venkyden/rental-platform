import os
import json
import logging
from cryptography.fernet import Fernet
from typing import Any, Dict, Optional
from sqlalchemy import TypeDecorator, String

logger = logging.getLogger(__name__)

class EncryptionService:
    def __init__(self):
        # We try to get the key from environment or settings
        # If it doesn't exist, we fallback to SECRET_KEY (which is better than nothing, 
        # but Fernet requires a specific 32-byte base64 encoded key)
        key = os.getenv("MASTER_ENCRYPTION_KEY")
        
        if not key:
            # Generate a stable key from SECRET_KEY if possible, or warn
            from app.core.config import settings
            import base64
            import hashlib
            
            # Deterministically derive a 32-byte key from SECRET_KEY
            h = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            key = base64.urlsafe_b64encode(h).decode()
            logger.warning("⚠️ MASTER_ENCRYPTION_KEY not set. Deriving from SECRET_KEY.")
            
        try:
            self.fernet = Fernet(key.encode())
        except Exception as e:
            logger.error(f"❌ Failed to initialize Fernet: {e}")
            # Final fallback: generate a random one (DANGEROUS for persistence)
            self.fernet = Fernet(Fernet.generate_key())

    def encrypt_json(self, data: Dict[str, Any]) -> str:
        if data is None:
            return None
        try:
            json_str = json.dumps(data)
            return self.fernet.encrypt(json_str.encode()).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return None

    def decrypt_json(self, encrypted_str: str) -> Optional[Dict[str, Any]]:
        if not encrypted_str:
            return None
        
        # Check if it's already a dict (unencrypted legacy data)
        if isinstance(encrypted_str, dict):
            return encrypted_str
            
        try:
            decrypted_data = self.fernet.decrypt(encrypted_str.encode())
            return json.loads(decrypted_data.decode())
        except Exception:
            # Fallback for old unencrypted JSON strings
            try:
                return json.loads(encrypted_str)
            except Exception:
                # If it's not JSON and decryption failed, return as is or None
                return None

encryption_service = EncryptionService()

class EncryptedJSON(TypeDecorator):
    """
    SQLAlchemy type for storing encrypted JSON data.
    Automatically encrypts on write and decrypts on read.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encryption_service.encrypt_json(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return encryption_service.decrypt_json(value)
