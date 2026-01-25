# Test Logs Directory

This directory stores JSON logs from E2E test runs.

Each test run creates a file named: `test_{user_id}_{timestamp}.json`

## Contents

- `mongodb_seeding`: Results of seeding submissions into MongoDB
- `rag_seeding`: Results of seeding mistake patterns into ChromaDB
- `timestamp`: When the test was run
- `user_id`: The user ID being tested

## Usage

Run a test with:

```bash
cd ai-services
python scripts/test_user_flow.py <user_id>
```

The logs in this directory are NOT cleaned up automatically and can be used for debugging and analysis.
