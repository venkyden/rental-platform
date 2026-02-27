"""
Cloud Storage Service - Cloudflare R2 / S3 Compatible
Zero-cost alternative to AWS S3 for storing property media.
"""

import hashlib
import os
import uuid
from datetime import datetime, timedelta
from typing import BinaryIO, Optional

# Optional boto3 import - graceful fallback
try:
    import boto3
    from botocore.config import Config

    BOTO3_AVAILABLE = True
except ImportError:
    boto3 = None
    BOTO3_AVAILABLE = False


class CloudStorageService:
    """
    Cloud storage service supporting:
    - Cloudflare R2 (free tier: 10GB)
    - AWS S3
    - Any S3-compatible storage

    Falls back to local storage if not configured.
    """

    def __init__(self):
        self.client = None
        self.bucket_name = os.getenv("STORAGE_BUCKET", "rental-platform-media")
        self.is_local = True
        self.local_path = os.getenv("LOCAL_STORAGE_PATH", "./uploads")

        self._connect()

    def _connect(self):
        """Connect to cloud storage if configured"""
        if not BOTO3_AVAILABLE:
            print("⚠️ boto3 not installed. Using local storage (pip install boto3)")
            return

        # Use centralized settings
        from app.core.config import settings

        endpoint = settings.STORAGE_ENDPOINT
        access_key = settings.STORAGE_ACCESS_KEY
        secret_key = settings.STORAGE_SECRET_KEY
        self.bucket_name = settings.STORAGE_BUCKET

        if not endpoint:
            print("⚠️ STORAGE_ENDPOINT is missing.")
        if not access_key:
            print("⚠️ STORAGE_ACCESS_KEY is missing.")
        if not secret_key:
            print("⚠️ STORAGE_SECRET_KEY is missing.")

        if not all([endpoint, access_key, secret_key]):
            print("⚠️ Cloud storage not configured. Using local storage.")
            return

        try:
            self.client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
            )
            # Test connection
            self.client.list_buckets()
            self.is_local = False
            print(f"✅ Cloud storage connected: {endpoint}")
        except Exception as e:
            print(f"⚠️ Cloud storage connection failed: {e}. Using local storage.")
            self.client = None

    def _generate_key(self, filename: str, folder: str = "uploads") -> str:
        """Generate unique storage key"""
        ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
        unique_id = uuid.uuid4().hex[:16]
        timestamp = datetime.now().strftime("%Y/%m/%d")
        return f"{folder}/{timestamp}/{unique_id}.{ext}"

    async def upload_file(
        self,
        file_data: BinaryIO,
        filename: str,
        content_type: str = "application/octet-stream",
        folder: str = "properties",
    ) -> dict:
        """
        Upload file to cloud storage.

        Returns:
            {
                "url": "https://...",
                "key": "properties/2026/01/14/abc123.jpg",
                "size": 12345,
                "storage": "r2" | "local"
            }
        """
        file_data.seek(0)
        content = file_data.read()
        file_size = len(content)
        key = self._generate_key(filename, folder)

        if self.client and not self.is_local:
            # Upload to cloud storage
            try:
                self.client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=content,
                    ContentType=content_type,
                )

                # Generate public URL
                # For R2: https://{account_id}.r2.cloudflarestorage.com/{bucket}/{key}
                # For S3: https://{bucket}.s3.{region}.amazonaws.com/{key}
                base_url = os.getenv("STORAGE_PUBLIC_URL", "")
                url = f"{base_url}/{key}" if base_url else self._get_presigned_url(key)

                return {"url": url, "key": key, "size": file_size, "storage": "cloud"}
            except Exception as e:
                print(f"Cloud upload failed: {e}. Falling back to local.")

        # Fallback to local storage
        return await self._upload_local(content, key, file_size)

    async def _upload_local(self, content: bytes, key: str, file_size: int) -> dict:
        """Upload to local filesystem"""
        import aiofiles

        full_path = os.path.join(self.local_path, key)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        async with aiofiles.open(full_path, "wb") as f:
            await f.write(content)

        return {
            "url": f"/uploads/{key}",
            "key": key,
            "size": file_size,
            "storage": "local",
        }

    def _get_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """Generate presigned URL for private files"""
        if not self.client:
            return ""

        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expiration,
            )
        except Exception:
            return ""

    async def delete_file(self, key: str) -> bool:
        """Delete file from storage"""
        if self.client and not self.is_local:
            try:
                self.client.delete_object(Bucket=self.bucket_name, Key=key)
                return True
            except Exception as e:
                print(f"Cloud delete failed: {e}")
                return False
        else:
            # Local delete
            full_path = os.path.join(self.local_path, key)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False

    async def get_file_info(self, key: str) -> Optional[dict]:
        """Get file metadata"""
        if self.client and not self.is_local:
            try:
                response = self.client.head_object(Bucket=self.bucket_name, Key=key)
                return {
                    "size": response["ContentLength"],
                    "content_type": response["ContentType"],
                    "last_modified": response["LastModified"],
                }
            except Exception:
                return None
        else:
            full_path = os.path.join(self.local_path, key)
            if os.path.exists(full_path):
                stat = os.stat(full_path)
                return {
                    "size": stat.st_size,
                    "last_modified": datetime.fromtimestamp(stat.st_mtime),
                }
            return None


# Global instance
storage = CloudStorageService()


# Environment variables needed:
# STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
# STORAGE_ACCESS_KEY=your-access-key
# STORAGE_SECRET_KEY=your-secret-key
# STORAGE_BUCKET=rental-platform-media
# STORAGE_PUBLIC_URL=https://media.yourdomain.fr (optional, for public URLs)
