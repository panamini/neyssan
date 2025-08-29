# backfill.py
# This script handles backfilling and reconciling old, "bad" profiles.

import logging

# Configure logging for the script
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- MOCK DEPENDENCIES (REMOVE IN YOUR ACTUAL APP) ---
# This is for demonstration purposes
class MockProfile:
    def __init__(self, id, quality, status):
        self.id = id
        self.raw_quality = quality
        self.convex_status = status

class MockDb:
    def get_profiles(self, filters):
        # Return mock profiles for demonstration
        if filters.get("raw_quality") == "contact_only":
            return [MockProfile("p1", "contact_only", "ok")]
        if filters.get("convex_status") == "error":
            return [MockProfile("p2", "normal", "error")]
        return []
    
    def update_status(self, profile_id, status, reason):
        print(f"DB update for {profile_id}: status={status}, reason={reason}")

db = MockDb()
get_profiles = db.get_profiles
update_status = db.update_status

def run_pipeline(profile):
    print(f"Running pipeline for profile {profile.id}")

def reprocess_bad_profiles(batch_size=100):
    """
    Runs a one-time script to reprocess old profiles that failed or were incomplete.
    Includes batching for scalability and logging for monitoring progress.
    """
    # In your app, this would be a real query to your database
    bad = get_profiles(filters={"raw_quality": "contact_only"}) + get_profiles(filters={"convex_status": "error"})
    
    total_profiles = len(bad)
    logging.info(f"Found {total_profiles} profiles to reprocess.")
    
    for i in range(0, total_profiles, batch_size):
        batch = bad[i:i + batch_size]
        logging.info(f"Processing batch {i // batch_size + 1} of {total_profiles // batch_size + 1}...")
        
        for p in batch:
            try:
                # In your app, this would call the main pipeline function
                run_pipeline(p)
                # Correct: Update status on SUCCESS
                update_status(p.id, status="success_backfill", reason="reprocessed")
                logging.info(f"Reprocessed {p.id} successfully")
            except Exception as e:
                # Handle failures as before
                update_status(p.id, status="failed_backfill", reason=str(e))
                logging.error(f"Failed to reprocess {p.id}: {str(e)}")
                
    logging.info("Backfill process completed.")

# --- MOCK DEPENDENCIES (REMOVE IN YOUR ACTUAL APP) ---
# This is for demonstration purposes
class MockProfile:
    def __init__(self, id, quality, status):
        self.id = id
        self.raw_quality = quality
        self.convex_status = status

class MockDb:
    def get_profiles(self, filters):
        # Return mock profiles for demonstration
        if filters.get("raw_quality") == "contact_only":
            return [MockProfile("p1", "contact_only", "ok")]
        if filters.get("convex_status") == "error":
            return [MockProfile("p2", "normal", "error")]
        return []
    
    def update_status(self, profile_id, status, reason):
        print(f"DB update for {profile_id}: status={status}, reason={reason}")
