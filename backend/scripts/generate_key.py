#!/usr/bin/env python3
"""
Utility script to generate a secure 32-byte Base64 encoded key for MASTER_ENCRYPTION_KEY.
Usage: python scripts/generate_key.py
"""
import os
import sys

# Add the backend directory to sys.path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.utils.encryption import EncryptionService
    
    key = EncryptionService.generate_key()
    
    print("\n" + "="*60)
    print("🔑 NEW MASTER ENCRYPTION KEY GENERATED")
    print("="*60)
    print(f"\n{key}\n")
    print("="*60)
    print("INSTRUCTIONS:")
    print("1. Copy the key above.")
    print("2. Add it to your .env file:")
    print("   MASTER_ENCRYPTION_KEY=your_key_here")
    print("3. RESTART your backend server.")
    print("\nWARNING: Do NOT lose this key if you have already encrypted data.")
    print("="*60 + "\n")

except ImportError:
    # Fallback if app is not in path
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    print(f"Generated Key (Fallback): {key}")
