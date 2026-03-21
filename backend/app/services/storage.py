"""
Cloud Storage Service - Cloudflare R2 / S3 Compatible
Zero-cost alternative to AWS S3 for storing property media.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import BinaryIO, Optional

logger = logging.getLogger(__name__)

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
    In production (ENVIRONMENT=production), local fallback logs a loud error
    since Render's filesystem is ephemeral.
    """

    def __init__(self):
        self.client = None
        self.bucket_name = os.getenv("STORAGE_BUCKET", "rental-platform-media")
        self.is_local = True
        self.local_path = os.getenv("LOCAL_STORAGE_PATH", "./uploads")
        self.public_url: Optional[str] = None
        self._is_production = os.getenv("ENVIRONMENT", "development") == "production"
        self._connection_error: Optional[str] = None

        self._connect()

    def _connect(self):
        """Connect to cloud storage if configured"""
        if not BOTO3_AVAILABLE:
            self._connection_error = "boto3 not installed"
            logger.warning("⚠️ boto3 not installed. Using local storage (pip install boto3)")
            return

        # Use centralized settings
        from app.core.config import settings

        endpoint = settings.STORAGE_ENDPOINT.strip() if settings.STORAGE_ENDPOINT else None
        access_key = settings.STORAGE_ACCESS_KEY.strip() if settings.STORAGE_ACCESS_KEY else None
        secret_key = settings.STORAGE_SECRET_KEY.strip() if settings.STORAGE_SECRET_KEY else None
        self.bucket_name = settings.STORAGE_BUCKET.strip() if settings.STORAGE_BUCKET else "rental-platform-media"
        self.public_url = settings.STORAGE_PUBLIC_URL.strip() if settings.STORAGE_PUBLIC_URL else None

        missing = []
        if not endpoint:
            missing.append("STORAGE_ENDPOINT")
        if not access_key:
            missing.append("STORAGE_ACCESS_KEY")
        if not secret_key:
            missing.append("STORAGE_SECRET_KEY")

        if missing:
            self._connection_error = f"Missing env vars: {', '.join(missing)}"
            if self._is_production:
                logger.error(
                    f"🚨 PRODUCTION: Cloud storage credentials missing ({', '.join(missing)}). "
                    f"Uploads will use LOCAL storage which is EPHEMERAL on Render — "
                    f"files WILL BE LOST on redeploy!"
                )
            else:
                logger.warning(f"⚠️ Cloud storage not configured ({', '.join(missing)}). Using local storage.")
            return

        if not self.public_url:
            if self._is_production:
                logger.warning(
                    "⚠️ STORAGE_PUBLIC_URL not set. Cloud uploads will use presigned URLs "
                    "with short expiry instead of permanent public links."
                )

        try:
            self.client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                config=Config(
                    signature_version="s3v4",
                    retries={"max_attempts": 3},
                ),
                region_name="auto",  # Required for R2
            )
            self.is_local = False
            self._connection_error = None
            logger.info(f"✅ Cloud storage configured: {endpoint} (bucket: {self.bucket_name})")
        except Exception as e:
            self._connection_error = str(e)
            logger.error(f"⚠️ Cloud storage connection failed: {e}. Using local storage.")
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

        Raises HTTPException in production if cloud storage is not available.
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
                if self.public_url:
                    url = f"{self.public_url.rstrip('/')}/{key}"
                else:
                    url = self._get_presigned_url(key)

                logger.info(f"☁️ Uploaded to cloud: {key} ({file_size} bytes)")
                return {"url": url, "key": key, "size": file_size, "storage": "cloud"}
            except Exception as e:
                logger.error(f"Cloud upload failed for key={key}: {e}")
                if self._is_production:
                    # In production, do NOT silently fall back to ephemeral local storage
                    raise RuntimeError(
                        f"Cloud storage upload failed: {e}. "
                        f"Cannot fall back to local storage in production (ephemeral filesystem)."
                    )
                logger.warning(f"Falling back to local storage (dev mode).")

        elif self._is_production:
            # Cloud is not configured at all in production
            logger.error(
                f"🚨 No cloud storage client available in production. "
                f"Reason: {self._connection_error or 'unknown'}. "
                f"File will be saved locally but WILL BE LOST on redeploy."
            )

        # Fallback to local storage (dev mode, or production with warning)
        return await self._upload_local(content, key, file_size)

    async def _upload_local(self, content: bytes, key: str, file_size: int) -> dict:
        """Upload to local filesystem"""
        import aiofiles

        if self._is_production:
            logger.warning(
                f"⚠️ Saving to LOCAL storage in production. "
                f"This file WILL BE LOST on Render redeploy: {key}"
            )

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
                logger.error(f"Cloud delete failed: {e}")
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

    def get_health(self) -> dict:
        """Return diagnostic info about storage configuration"""
        info = {
            "mode": "cloud" if (self.client and not self.is_local) else "local",
            "bucket": self.bucket_name if not self.is_local else None,
            "public_url_configured": bool(self.public_url),
            "environment": "production" if self._is_production else "development",
            "connection_error": self._connection_error,
        }

        if self.client and not self.is_local:
            # Quick test: list objects with max 1 to verify credentials work
            try:
                self.client.list_objects_v2(Bucket=self.bucket_name, MaxKeys=1)
                info["status"] = "connected"
            except Exception as e:
                info["status"] = f"error: {e}"
        else:
            info["status"] = "local_only"

        return info


# Global instance
storage = CloudStorageService()


# Environment variables needed:
# STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
# STORAGE_ACCESS_KEY=your-access-key
# STORAGE_SECRET_KEY=your-secret-key
# STORAGE_BUCKET=rental-platform-media
# STORAGE_PUBLIC_URL=https://media.yourdomain.fr (optional, for public URLs)
