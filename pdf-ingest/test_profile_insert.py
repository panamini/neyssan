#!/usr/bin/env python3
"""
Test script to verify profile insertion into the database.
Run with: python test_profile_insert.py
"""

import asyncio
import uuid
import os
import sys
from datetime import datetime, timezone

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_profile_insert():
    """Test inserting a profile into the database"""
    try:
        from db import get_session
        from models import Profile
        from sqlalchemy import insert
        
        print("Testing profile insertion...")
        
        # Properly handle the async generator
        session_gen = get_session()
        session = await session_gen.__anext__()
        
        try:
            # Create minimal test profile data
            profile_data = {
                "id": uuid.uuid4(),
                "name": "Test User",
                "email": "test@example.com",
                "summary": "Test summary for database insertion",
                "skills": ["Python", "SQL", "FastAPI"],
                "experience": [{
                    "company": "Test Company", 
                    "title": "Software Developer",
                    "startDate": "2020-01-01",
                    "endDate": "2023-12-31",
                    "description": "Developed web applications"
                }],
                "raw_text": "This is raw text content for testing",
                "confidence": 0.8,
                "version": 1,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            print("Attempting to insert profile...")
            stmt = insert(Profile).values(**profile_data)
            result = await session.execute(stmt)
            await session.commit()
            
            print("✓ Profile insertion successful")
            print(f"Inserted profile ID: {profile_data['id']}")
            
            # Verify the profile was inserted by querying it back
            from sqlalchemy.future import select
            query = select(Profile).where(Profile.id == profile_data['id'])
            result = await session.execute(query)
            fetched_profile = result.scalar_one_or_none()
            
            if fetched_profile:
                print("✓ Profile successfully retrieved from database")
                print(f"Name: {fetched_profile.name}")
                print(f"Email: {fetched_profile.email}")
                print(f"Confidence: {fetched_profile.confidence}")
            else:
                print("✗ Profile not found after insertion")
                
        except Exception as e:
            print(f"✗ Insert failed: {e}")
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
    asyncio.run(test_profile_insert())
