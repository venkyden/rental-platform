import os
import json
import logging
from cryptography.fernet import Fernet
from typing import Any, Dict, Optional
from sqlalchemy import TypeDecorator, String

logger = logging.getLogger(__name__)

class EncryptionService:
    def __init__(self):
        from app.core.config import settings
        import base64
        import hashlib
        
        # Priority 1: settings.MASTER_ENCRYPTION_KEY (Explicitly set in .env or environment)
        key = settings.MASTER_ENCRYPTION_KEY
        
        if not key:
            # Priority 2: OS Environment (legacy/direct override)
            key = os.getenv("MASTER_ENCRYPTION_KEY")
        
        if not key:
            # Fallback: Deterministically derive a 32-byte key from SECRET_KEY
            # This ensures stable encryption/decryption in dev even if no key is set.
            # However, we warn the user as this is less secure.
            h = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
            key = base64.urlsafe_b64encode(h).decode()
            logger.warning("⚠️ MASTER_ENCRYPTION_KEY not set. Deriving from SECRET_KEY (Dev mode).")
            self.mode = "fallback"
        else:
            self.mode = "secure"
            
        try:
            self.fernet = Fernet(key.encode())
        except Exception as e:
            logger.error(f"❌ Failed to initialize Fernet: {e}")
            # Absolute last resort: generate a random one (Warning: Data will be lost on restart!)
            self.fernet = Fernet(Fernet.generate_key())
            self.mode = "ephemeral"

    @staticmethod
    def generate_key() -> str:
        """Utility to generate a secure 32-byte Base64 encoded key for MASTER_ENCRYPTION_KEY"""
        return Fernet.generate_key().decode()

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
