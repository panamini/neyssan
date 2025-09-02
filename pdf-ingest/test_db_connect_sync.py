#!/usr/bin/env python3
"""
Synchronous test script to verify database connectivity and inspect table structure.
Uses the sync engine from db.py to avoid async dependencies.
Run with: python test_db_connect_sync.py
"""

import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_connection_sync():
    """Test database connection synchronously and inspect table structure"""
    try:
        from sqlalchemy import inspect
        from db import sync_engine
        
        print("Testing database connection (synchronous)...")
        
        with sync_engine.connect() as conn:
            print("✓ Database connection successful")
            
            # Inspect table structure
            inspector = inspect(conn)
            
            # Check if profiles table exists
            tables = inspector.get_table_names()
            print(f"Available tables: {tables}")
            
            if 'profiles' in tables:
                print("\nProfiles table columns:")
                columns = inspector.get_columns('profiles')
                for col in columns:
                    print(f"  {col['name']}: {col['type']} (nullable: {col['nullable']})")
                    
                # Check constraints
                try:
                    constraints = inspector.get_unique_constraints('profiles')
                    print(f"\nUnique constraints on profiles table: {constraints}")
                except Exception as e:
                    print(f"\nError getting unique constraints: {e}")
                
                # Check indexes
                indexes = inspector.get_indexes('profiles')
                print(f"Indexes on profiles table: {indexes}")
            else:
                print("✗ Profiles table does not exist")
                
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_connection_sync()
