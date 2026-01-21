#!/usr/bin/env python3
"""Test registration endpoint directly"""
import asyncio
import sys
from sqlalchemy import text

# Add parent directory to path
sys.path.insert(0, '/Users/venkat/.gemini/antigravity/scratch/rental-platform/backend')

from app.core.database import engine
from app.models.user import Base

async def test_connection():
    """Test database connection and show tables"""
    try:
        async with engine.begin() as conn:
            # Check connection
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ PostgreSQL connection successful: {version}")
            
            # Show tables
            result = await conn.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public'
            """))
            tables = result.fetchall()
            print(f"\n📊 Tables in database:")
            for table in tables:
                print(f"   - {table[0]}")
            
            # Count users
            result = await conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"\n👥 Current user count: {count}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
