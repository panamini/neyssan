#!/usr/bin/env python3
"""
Test script to verify the upsert operation used in confirm_save.
Run with: python test_upsert_operation.py
"""

import asyncio
import uuid
import os
import sys
from datetime import datetime, timezone

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_upsert_operation():
    """Test the upsert operation that confirm_save uses"""
    try:
        from db import get_session
        from models import Profile
        from sqlalchemy import insert
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        
        print("Testing upsert operation (on_conflict_do_update)...")
        
        # Properly handle the async generator
        session_gen = get_session()
        session = await session_gen.__anext__()
        
        try:
            # Create test profile data similar to what confirm_save would use
            profile_data = {
                "id": uuid.uuid4(),
                "name": "Test User for Upsert",
                "email": "upsert_test@example.com",
                "summary": "Test summary for upsert operation",
                "skills": ["Python", "SQL", "FastAPI"],
                "experience": [{
                    "company": "Test Co", 
                    "title": "Developer",
                    "startDate": "2020-01-01",
                    "endDate": "2023-12-31",
                    "description": "Developed applications"
                }],
                "raw_text": "Raw text for upsert test",
                "confidence": 0.7,
                "version": 1,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            print("Attempting upsert operation with on_conflict_do_update...")
            
            # This is the exact same operation as in confirm_save_handler
            insert_stmt = pg_insert(Profile).values(**profile_data)
            on_conflict_stmt = insert_stmt.on_conflict_do_update(
                index_elements=[Profile.email],
                set_={
                    "name": insert_stmt.excluded.name,
                    "summary": insert_stmt.excluded.summary,
                    "skills": insert_stmt.excluded.skills,
                    "experience": insert_stmt.excluded.experience,
                    "raw_text": insert_stmt.excluded.raw_text,
                    "confidence": insert_stmt.excluded.confidence,
                    "updated_at": datetime.now(timezone.utc),
                }
            ).returning(Profile.id, Profile.created_at, Profile.updated_at, Profile.confidence)

            result = await session.execute(on_conflict_stmt)
            saved_profile = result.first()
            await session.commit()
            
            if saved_profile:
                print("✓ Upsert operation successful")
                print(f"Profile ID: {saved_profile.id}")
                print(f"Created at: {saved_profile.created_at}")
                print(f"Updated at: {saved_profile.updated_at}")
                print(f"Confidence: {saved_profile.confidence}")
            else:
                print("✗ Upsert failed - no result returned")
                
        except Exception as e:
            print(f"✗ Upsert operation failed: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
        finally:
            await session.close()
            
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_upsert_operation())
