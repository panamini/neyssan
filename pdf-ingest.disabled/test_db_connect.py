#!/usr/bin/env python3
"""
Test script to verify database connectivity and inspect table structure.
Run with: python test_db_connect.py
"""

import asyncio
import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_connection():
    """Test database connection and inspect table structure"""
    try:
        from sqlalchemy import inspect
        from db import engine
        
        print("Testing database connection...")
        
        async with engine.connect() as conn:
            print("✓ Database connection successful")
            
            # Inspect table structure
            inspector = await conn.run_sync(lambda sync_conn: inspect(sync_conn))
            
            # Check if profiles table exists
            tables = await conn.run_sync(lambda sync_conn: inspector.get_table_names())
            print(f"Available tables: {tables}")
            
            if 'profiles' in tables:
                print("\nProfiles table columns:")
                columns = await conn.run_sync(lambda sync_conn: inspector.get_columns('profiles'))
                for col in columns:
                    print(f"  {col['name']}: {col['type']} (nullable: {col['nullable']})")
                    
                # Check constraints
                constraints = await conn.run_sync(lambda sync_conn: inspector.get_unique_constraints('profiles'))
                print(f"\nUnique constraints on profiles table: {constraints}")
                
                # Check indexes
                indexes = await conn.run_sync(lambda sync_conn: inspector.get_indexes('profiles'))
                print(f"Indexes on profiles table: {indexes}")
            else:
                print("✗ Profiles table does not exist")
                
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
