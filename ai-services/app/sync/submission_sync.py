from app.db.mongodb import mongo_client
from app.rag.retriever import store_user_feedback
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def sync_recent_submissions(hours: int = 24):
    """Sync recent submissions from MongoDB to RAG"""
    
    if not mongo_client.db:
        logger.error("MongoDB not connected")
        return 0
    
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    try:
        # Find recent failed submissions
        submissions = mongo_client.db.submissions.find({
            "status": {"$ne": "accepted"},
            "createdAt": {"$gte": cutoff_time},
            "isRun": False
        })
        
        synced_count = 0
        for submission in submissions:
            try:
                mongo_client.sync_submission_to_rag(submission)
                synced_count += 1
            except Exception as e:
                logger.error(f"Failed to sync submission {submission['_id']}: {e}")
        
        logger.info(f"✅ Synced {synced_count} submissions to RAG")
        return synced_count
    
    except Exception as e:
        logger.error(f"❌ Sync failed: {e}")
        return 0