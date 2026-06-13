#!/usr/bin/env python3
"""
Generate secure keys for Roomivo.

Usage:
  python scripts/generate_key.py                  # MASTER_ENCRYPTION_KEY (Fernet)
  python scripts/generate_key.py --credential-key # CREDENTIAL_SIGNING_KEY (Ed25519 seed)
  python scripts/generate_key.py --all            # both keys
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_mode = sys.argv[1] if len(sys.argv) > 1 else ""


def gen_encryption_key() -> str:
    try:
        from app.utils.encryption import EncryptionService
        return EncryptionService.generate_key()
    except ImportError:
        from cryptography.fernet import Fernet
        return Fernet.generate_key().decode()


def gen_credential_key() -> str:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    return Ed25519PrivateKey.generate().private_bytes_raw().hex()


if _mode in ("", "--all"):
    key = gen_encryption_key()
    print("\n" + "=" * 60)
    print("🔑 MASTER_ENCRYPTION_KEY (Fernet)")
    print("=" * 60)
    print(f"\n{key}\n")
    print("Add to .env:  MASTER_ENCRYPTION_KEY=" + key)
    print("=" * 60)

if _mode in ("--credential-key", "--all"):
    seed_hex = gen_credential_key()
    print("\n" + "=" * 60)
    print("🔑 CREDENTIAL_SIGNING_KEY (Ed25519 seed, 64 hex chars)")
    print("=" * 60)
    print(f"\n{seed_hex}\n")
    print("Add to .env:  CREDENTIAL_SIGNING_KEY=" + seed_hex)
    print("WARNING: losing this key invalidates all previously signed credentials.")
    print("=" * 60 + "\n")

if _mode not in ("", "--credential-key", "--all"):
    print(f"Unknown flag: {_mode}")
    print(__doc__)
    sys.exit(1)
