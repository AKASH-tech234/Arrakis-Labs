from motor.motor_asyncio import AsyncIOMotorClient

from pymongo import MongoClient, uri_parser
import os
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class MongoDBClient:
    """Direct MongoDB access for AI services"""
    
    def __init__(self):
        self.mongo_uri = os.getenv("MONGODB_URI")
        # Allow specifying database name separately when URI omits a default database
        self.db_name = os.getenv("MONGODB_DB_NAME") or os.getenv("MONGODB_DB")
        self.client = None
        self.db = None
    
    def connect(self):
        """Connect to MongoDB"""
        if not self.mongo_uri:
            print("⚠️  MONGODB_URI not set - MongoDB features disabled")
            logger.warning("MONGODB_URI not set - MongoDB features disabled")
            return False
        
        try:
            print(f"🔌 Connecting to MongoDB...")
            self.client = MongoClient(self.mongo_uri)

            # Resolve database name from env or URI; raise clear error if missing
            resolved_db = self._resolve_db_name(self.mongo_uri)
            if not resolved_db:
                raise ValueError("No default database defined. Set MONGODB_DB_NAME or include a database in MONGODB_URI")

            self.db = self.client.get_database(resolved_db)
            
            # Test connection
            self.client.admin.command('ping')
            print(f"✅ MongoDB connected successfully - Database: {self.db.name}")
            logger.info("✅ MongoDB connected successfully")
            return True
        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            logger.error(f"❌ MongoDB connection failed: {e}")
            return False

    def _resolve_db_name(self, uri: str) -> Optional[str]:
        """Determine the database name from env or URI."""
        if self.db_name:
            return self.db_name
        try:
            parsed = uri_parser.parse_uri(uri)
            return parsed.get("database")
        except Exception as e:
            logger.error(f"Failed to parse MongoDB URI for database name: {e}")
            return None
    
    def get_user_submissions(
        self,
        user_id: str,
        limit: int = 50,
        problem_id: str = None
    ) -> List[Dict[str, Any]]:
        """Get user's submission history"""
        
        if self.db is None:
            print(f"⚠️  MongoDB not connected - cannot fetch submissions for user: {user_id}")
            return []
        
        query = {"userId": user_id, "isRun": False}
        if problem_id:
            query["questionId"] = problem_id
        
        print(f"📊 Fetching submissions from MongoDB:")
        print(f"   └─ user_id: {user_id}")
        print(f"   └─ problem_id: {problem_id or 'all'}")
        print(f"   └─ limit: {limit}")
        
        try:
            submissions = list(
                self.db.submissions
                .find(query)
                .sort("createdAt", -1)
                .limit(limit)
            )
            
            print(f"✅ Found {len(submissions)} submissions for user: {user_id}")
            
            # Convert ObjectId to string
            for sub in submissions:
                sub["_id"] = str(sub["_id"])
                sub["userId"] = str(sub["userId"])
                sub["questionId"] = str(sub["questionId"])
            
            return submissions
        except Exception as e:
            print(f"❌ Error fetching submissions from MongoDB: {e}")
            logger.error(f"Error fetching submissions: {e}")
            return []
    
    def get_user_profile_data(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive user profile from MongoDB"""
        
        if self.db is None:
            print(f"⚠️  MongoDB not connected - cannot fetch profile for user: {user_id}")
            return {}
        
        print(f"\n👤 Fetching user profile from MongoDB: {user_id}")
        
        try:
            # Get user document
            user = self.db.users.find_one({"_id": user_id})
            print(f"   └─ User document: {'Found' if user else 'Not found'}")
            
            # Get statistics
            submissions = self.get_user_submissions(user_id, limit=100)
            
            # Calculate stats
            total_submissions = len(submissions)
            accepted = len([s for s in submissions if s["status"] == "accepted"])
            success_rate = (accepted / total_submissions * 100) if total_submissions > 0 else 0
            
            print(f"   └─ Total submissions: {total_submissions}")
            print(f"   └─ Accepted: {accepted}")
            print(f"   └─ Success rate: {success_rate:.1f}%")
            
            # Get unique solved problems
            solved_problems = set(
                s["questionId"] for s in submissions if s["status"] == "accepted"
            )
            
            print(f"   └─ Unique problems solved: {len(solved_problems)}")
            
            # Recent categories
            recent_submissions = submissions[:20]
            categories = []
            for sub in recent_submissions:
                # You'd fetch problem details here
                pass
            
            profile_data = {
                "user_id": user_id,
                "total_submissions": total_submissions,
                "accepted_submissions": accepted,
                "success_rate": success_rate,
                "unique_problems_solved": len(solved_problems),
                "recent_submissions": recent_submissions[:10],
            }
            
            print(f"✅ User profile data retrieved successfully\n")
            return profile_data
        except Exception as e:
            print(f"❌ Error fetching user profile from MongoDB: {e}\n")
            logger.error(f"Error fetching user profile: {e}")
            return {}
    
    def sync_submission_to_rag(self, submission: Dict[str, Any]):
        """Sync failed submission to RAG store"""
        
        from app.rag.retriever import store_user_feedback
        
        if submission["status"] == "accepted":
            print(f"ℹ️  Skipping accepted submission - not storing to RAG")
            return  # Don't store accepted submissions
        
        # Extract mistake summary
        mistake_summary = f"Submission failed with {submission['status']}"
        
        print(f"💾 Syncing submission to RAG:")
        print(f"   └─ user_id: {submission['userId']}")
        print(f"   └─ problem_id: {submission['questionId']}")
        print(f"   └─ status: {submission['status']}")
        
        # Store in RAG
        result = store_user_feedback(
            user_id=str(submission["userId"]),
            problem_id=str(submission["questionId"]),
            category="General",  # Would fetch from problem
            mistake_summary=mistake_summary
        )
        
        if result:
            print(f"✅ Submission synced to RAG successfully")
        else:
            print(f"⚠️  Failed to sync submission to RAG")


# Singleton
mongo_client = MongoDBClient()


def get_database():
    """
    Get the MongoDB database instance.
    
    Convenience function for test mocking and external access.
    
    Returns:
        MongoDB database instance, or None if not connected
    """
    return mongo_client.db