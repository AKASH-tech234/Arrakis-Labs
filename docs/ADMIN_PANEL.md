# Arrakis Labs Admin Panel

## Overview
This admin panel allows administrators to manage questions, test cases, and monitor the online judge system.

## Setup

### 1. Create Admin Account
Admin accounts are NOT created via UI for security. Use the seed script:

```bash
cd backend
npm run seed:admin
```

This creates two default admins:
- **Super Admin**: `superadmin@arrakis.dev` / `SuperSecurePass123!`
- **Admin**: `admin@arrakis.dev` / `AdminPass456!`

⚠️ **IMPORTANT**: Change these passwords immediately in production!

### 2. Environment Variables
Ensure these are set in `backend/.env`:

```env
JWT_SECRET=your-secret-key-change-in-production
MONGODB_URI=your-mongodb-uri
```

### 3. Start the Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 4. Access Admin Panel
Navigate to: `http://localhost:5173/admin/login`

---

## Features

### Dashboard
- Overview statistics
- Question counts by difficulty
- Submission analytics

### CSV Upload
Bulk import questions with test cases.

#### CSV Format

| Column | Required | Description |
|--------|----------|-------------|
| `title` | ✓ | Question title |
| `description` | ✓ | Problem description |
| `difficulty` | ✓ | Easy, Medium, or Hard |
| `constraints` | | Problem constraints |
| `examples` | | JSON array of visible examples |
| `test_cases` | | JSON array of test cases |
| `tags` | | JSON array or comma-separated |

#### Hidden vs Visible Test Cases

- `test_cases` is stored in the database as Piston-compatible `stdin` + `expectedStdout`.
- By default, during CSV import the **first 2 test cases become visible** (used by **Run**), and the **rest become hidden** (used by **Submit**).
- You can override per test case with an optional boolean field `is_hidden`.

Supported fields inside each `test_cases` array item:

- `input` (required): JSON object/array/string that will be converted to `stdin`
- `expected_output` (required): expected result
- `is_hidden` (optional): `true` / `false` (overrides the default rule)
- `label` (optional)
- `time_limit` (optional, ms)
- `memory_limit` (optional, MB)

#### Example CSV
```csv
title,description,difficulty,constraints,examples,test_cases,tags
Two Sum,"Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",Easy,"2 <= nums.length <= 10^4","[{""input"": ""nums = [2,7,11,15], target = 9"", ""output"": ""[0,1]""}]","[{""input"": {""nums"": [2,7,11,15], ""target"": 9}, ""expected_output"": [0,1], ""is_hidden"": false}, {""input"": {""nums"": [3,2,4], ""target"": 6}, ""expected_output"": [1,2], ""is_hidden"": false}, {""input"": {""nums"": [3,3], ""target"": 6}, ""expected_output"": [0,1], ""is_hidden"": true}]","[""Array"", ""Hash Table""]"
```

### Question Management
- Create/Edit/Delete questions
- View question details
- Manage tags and examples

### Test Case Management
- Add/Edit/Delete test cases
- Toggle hidden visibility
- **Hidden test cases** are never exposed to users
- **Visible test cases** are shown during "Run" for debugging

---

## API Endpoints

### Admin Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| POST | `/api/admin/logout` | Admin logout |
| GET | `/api/admin/profile` | Get admin profile |
| GET | `/api/admin/dashboard` | Get dashboard stats |

### Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/questions` | List all questions |
| GET | `/api/admin/questions/:id` | Get single question |
| POST | `/api/admin/questions` | Create question |
| PUT | `/api/admin/questions/:id` | Update question |
| DELETE | `/api/admin/questions/:id` | Delete question |

### Test Cases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/questions/:id/test-cases` | Get test cases |
| POST | `/api/admin/questions/:id/test-cases` | Create test case |
| PUT | `/api/admin/test-cases/:id` | Update test case |
| DELETE | `/api/admin/test-cases/:id` | Delete test case |
| PATCH | `/api/admin/test-cases/:id/toggle-hidden` | Toggle hidden |

### CSV Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/preview-csv` | Preview CSV |
| POST | `/api/admin/upload-csv` | Upload and process CSV |

### Public Judge API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | List public questions |
| GET | `/api/questions/:id` | Get public question |
| POST | `/api/run` | Run code (visible tests only) |
| POST | `/api/submit` | Submit code (all tests) |
| GET | `/api/submissions` | Get user submissions |

---

## Security

### Hidden Test Cases
- Hidden test cases are NEVER exposed to users
- During "Submit", users only see pass/fail status
- Full stdin/stdout only shown for visible test cases

### Admin Authentication
- Separate JWT tokens with `isAdmin: true` flag
- 12-round bcrypt password hashing
- Rate limiting on login (5 attempts per 15 min)
- Audit logging for all admin actions

### Rate Limiting
- General API: 100 requests per 15 min
- User Auth: 10 attempts per 15 min
- Admin Auth: 5 attempts per 15 min

---

## Test Case Format

### stdin Format (Piston Compatible)
```
4           // array length
2 7 11 15   // array elements (space-separated)
9           // target value
```

### JSON Input (Converted Automatically)
```json
{
  "nums": [2, 7, 11, 15],
  "target": 9
}
```

The `jsonToStdin` utility automatically converts JSON to stdin format:
- Arrays: length on first line, then space-separated values
- 2D arrays: length, then each row on new line
- Scalars: value on new line
