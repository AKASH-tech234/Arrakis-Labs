# CSV Upload Format (Admin)

The admin CSV uploader accepts these columns (headers are case-insensitive; spaces/hyphens are allowed):

- **Required**: `title`, `description`, `difficulty`
- **Optional**: `id`, `created_at`, `updated_at`, `constraints`, `example` (or `examples`), `test_cases`, `tags`

Notes:
- `difficulty` must be one of: `Easy`, `Medium`, `Hard`
- `created_at` / `updated_at` should be ISO strings (e.g. `2025-03-02T10:15:30Z`) or any JS-parseable date string
- `example` can be a single JSON object; `examples` can be a JSON array of objects
- `test_cases` must be a JSON array of objects with `input` and `expected_output`

Minimal header example:
`title,description,difficulty`

Full header example:
`id,title,description,difficulty,created_at,updated_at,examples,constraints,test_cases,tags`

JSON field examples:

`examples` (array):
`[{"input":[1,2,3],"output":6,"explanation":"Sum all"}]`

`example` (single object also allowed):
`{"input":[1,2],"output":3}`

`test_cases` (array):
`[{"input":{"nums":[1,2],"target":3},"expected_output":true},{"input":{"nums":[1,1],"target":3},"expected_output":false}]`

# Arrakis Labs – Code of the Desert

## Enterprise Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** January 15, 2026  
**Document Owner:** Principal Product Manager & AI Systems Architect  
**Classification:** Internal - Engineering Implementation

---


## Document Control

| Version | Date         | Author       | Changes                   |
| ------- | ------------ | ------------ | ------------------------- |
| 1.0     | Jan 14, 2026 | Product Team | Initial comprehensive PRD |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Target Users & Personas](#2-target-users--personas)
3. [Core User Journeys](#3-core-user-journeys)
4. [Functional Requirements](#4-functional-requirements)
5. [AI System Design](#5-ai-system-design)
6. [UI/UX Design](#6-uiux-design)
7. [Social Features](#7-social-features)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Tech Stack](#9-tech-stack)
10. [Data Models](#10-data-models)
11. [Metrics & KPIs](#11-metrics--kpis)
12. [Risks & Mitigations](#12-risks--mitigations)
13. [15-Day Delivery Plan](#13-15-day-delivery-plan)
14. [Future Roadmap](#14-future-roadmap)
15. [Baseline Functional Requirements (MVP)](#15-baseline-functional-requirements-mvp)

---

## 1. Executive Summary

### 1.1 Product Vision

Mentat Trials is an AI-first competitive programming platform that transcends traditional online judges. Inspired by the Mentats of Dune—humans trained to process information with computer-like precision while maintaining intuition and creativity—this platform uses advanced AI memory systems to become a true learning companion.

**Core Thesis:** Code evaluation without learning intelligence is incomplete. Every submission, every mistake, every breakthrough becomes part of a persistent memory that enables truly personalized, context-aware mentorship.

### 1.2 What Makes This Fundamentally Different

**Traditional Online Judges:**

- Binary pass/fail verdicts
- No memory of user learning patterns
- Generic hints (if any)
- No progression intelligence
- Static difficulty curves

**Mentat Trials:**

- AI remembers every interaction across time
- Analyzes learning patterns using RAG (Retrieval-Augmented Generation)
- Agentic workflows that coordinate multiple specialized AI systems
- Dynamic difficulty calibration based on individual growth
- Personalized learning paths that evolve

### 1.3 Why AI Memory and Agents Are Central

**Memory as Product Foundation:**
The platform maintains a comprehensive vector database of:

- Every code submission with context
- Historical feedback interactions
- Learning velocity patterns
- Struggle points and breakthrough moments
- Cross-problem pattern recognition

**Agentic Architecture:**
Instead of a single monolithic AI, Mentat Trials deploys specialized agents:

- **Feedback Agent:** Provides contextual code analysis
- **Learning Path Agent:** Recommends next problems based on growth trajectory
- **Difficulty Calibration Agent:** Adjusts challenge levels dynamically
- **Motivation Agent:** Maintains engagement through personalized encouragement
- **Analytics Agent:** Generates comprehensive learning reports

This multi-agent system creates emergent intelligence greater than any single LLM call could provide.

---

## 2. Target Users & Personas

### 2.1 Persona: Alex - The Eager Beginner

**Demographics:**

- Age: 18-22
- Background: CS student or self-taught programmer
- Experience: Knows basic syntax, struggles with algorithmic thinking

**Goals:**

- Build problem-solving confidence
- Prepare for technical interviews
- Understand WHY solutions work, not just WHAT works

**Pain Points:**

- Overwhelmed by problem difficulty
- Doesn't know where to start
- Gets stuck without understanding why
- Loses motivation after failures

**Mentat Trials Value:**

- AI breaks down complex problems into digestible steps
- Remembers struggle patterns and adjusts difficulty
- Provides encouragement aligned with learning style
- Celebrates small wins to maintain momentum

### 2.2 Persona: Jordan - The Interview Grinder

**Demographics:**

- Age: 23-30
- Background: Working professional preparing for job switch
- Experience: Solid fundamentals, needs interview-specific training

**Goals:**

- Master medium/hard LeetCode-style problems
- Optimize time complexity thinking
- Build muscle memory for common patterns
- Track progress systematically

**Pain Points:**

- Limited practice time (evenings/weekends)
- Needs efficient learning, not random practice
- Wants to identify weak areas quickly
- Forgets patterns between practice sessions

**Mentat Trials Value:**

- AI identifies gaps in pattern knowledge
- Suggests optimal next problems based on available time
- Refreshes forgotten concepts proactively
- Provides weekly synthesis reports

### 2.3 Persona: Morgan - The Competitive Coder

**Demographics:**

- Age: 16-25
- Background: Active in Codeforces, CodeChef, ICPC
- Experience: Advanced algorithms, seeks edge optimization

**Goals:**

- Find edge cases in solutions
- Optimize from O(n log n) to O(n)
- Learn advanced techniques (segment trees, FFT)
- Challenge intellectual boundaries

**Pain Points:**

- Needs deeper analysis than "Wrong Answer"
- Wants to understand competitive tricks
- Seeks validation of unusual approaches
- Craves intellectual stimulation

**Mentat Trials Value:**

- AI analyzes algorithmic complexity deeply
- Suggests alternative approaches with trade-offs
- Recognizes creative solutions outside standard patterns
- Provides advanced technique recommendations

### 2.4 Persona: Sam - The Problem Curator (Admin)

**Demographics:**

- Age: 25-40
- Background: Experienced programmer, educator, or platform contributor
- Experience: Designs problems, manages educational content

**Goals:**

- Create high-quality problem sets
- Manage test cases and difficulty ratings
- Monitor platform quality
- Understand learner engagement with problems

**Pain Points:**

- Hard to gauge problem difficulty accurately
- No feedback on problem quality
- Managing test cases is tedious
- Can't see learning analytics per problem

**Mentat Trials Value:**

- AI analyzes problem difficulty based on actual solver data
- Automated test case validation
- Analytics on where users struggle
- Problem quality scoring system

---

## 3. Core User Journeys

### 3.1 First-Time User Onboarding

**Journey Map:**

**Step 1: Landing (10 seconds)**

- User arrives at 3D desert-themed landing page
- Animated Mentat symbol rotates with parallax effect
- CTA: "Begin Your Training" (no account required to browse)

**Step 2: Initial Exploration (2 minutes)**

- User clicks into problem library
- Sees curated "Beginner Path" with visual progression
- Can preview problems without login

**Step 3: First Attempt Trigger (5 minutes)**

- User selects "Two Sum" equivalent problem
- System prompts: "Sign up to save your progress and unlock AI mentorship"
- One-click email/password registration

**Step 4: First Code Experience (10 minutes)**

- Integrated code editor with minimal UI
- "Run" button with sample inputs works immediately
- User submits solution

**Step 5: AI Introduction (Critical Moment)**

- Regardless of pass/fail: "Your Mentat is ready to analyze this submission"
- AI provides personalized feedback (not generic)
- Explains ONE concept deeply rather than listing many

**Step 6: Memory Activation**

- System: "I'll remember this interaction. As we work together, my guidance will become increasingly personalized."
- User profile shows first entry in learning journal

**Success Metrics:**

- 70% of visitors who start a problem complete registration
- 85% of registered users submit at least one solution
- 60% request AI feedback on first submission

### 3.2 Solving a Problem (Core Loop)

**Pre-Attempt:**

1. User browses problem library or receives AI recommendation
2. Clicks problem card → Problem Detail Page loads
3. Reads problem description, constraints, examples
4. Mental model: "What pattern does this need?"

**Active Solving:**

1. Writes code in integrated editor
2. Tests with custom inputs using "Run" button
3. Debugs based on output
4. Iterates until confident

**Submission:**

1. Clicks "Submit for Evaluation"
2. Code executes against hidden test cases
3. Verdict appears: Accepted / Wrong Answer / TLE / RE
4. For failures: Which test case failed (not the data)

**AI Feedback Request:**

1. User clicks "Get AI Analysis"
2. Loading state: "Mentat analyzing submission..."
3. AI feedback panel slides in from right
4. Contains:
   - What went wrong (if failed)
   - Complexity analysis
   - One optimization suggestion
   - Related concept to study
   - Link to similar problems

**Post-Submission:**

1. Submission logged in history
2. Analytics updated (streak, category progress)
3. AI silently updates user learning profile in vector DB

### 3.3 Receiving AI Feedback (Detailed Flow)

**Trigger Points:**

- Explicit: User clicks "Get AI Feedback" button
- Implicit: After 3 failed submissions, AI proactively offers help
- Scheduled: Weekly learning summary email

**Feedback Types by Context:**

**Scenario A: First Wrong Answer**

```
AI Tone: Encouraging, Educational
Content:
- "I see you're using a nested loop here. Let's think about what happens when n=10,000..."
- Explains time complexity conceptually
- Suggests: "Try solving this with a hash map to track seen values"
- Does NOT provide complete solution
```

**Scenario B: Third Wrong Answer on Same Problem**

```
AI Tone: Diagnostic, Supportive
Content:
- "I notice you've tried three different approaches. Let's analyze the pattern..."
- Compares approaches visually
- Identifies core misconception
- Offers: "Would you like a hint about the optimal data structure?"
```

**Scenario C: Accepted Solution (Non-Optimal)**

```
AI Tone: Validating, Growth-Oriented
Content:
- "Great work! Your solution is correct. I noticed it runs in O(n²)..."
- Shows complexity comparison with optimal solution
- Explains: "Here's how top 10% of solvers approached this..."
- Offers: "Ready to learn the O(n) approach?"
```

**Scenario D: Long-Term Pattern Recognition**

```
AI Tone: Mentorship, Strategic
Content:
- "Over the past two weeks, I've noticed you excel at array manipulation but struggle with recursive thinking..."
- Provides data visualization of strength/weakness map
- Recommends: "Let's focus on 5 carefully chosen recursion problems"
- Sets micro-goals with expected timeline
```

### 3.4 Long-Term Progress Tracking

**Daily Interaction:**

- User dashboard shows:
  - Current streak (with motivational message)
  - Today's recommended problem (AI-selected)
  - Recent submissions with quick re-analysis option

**Weekly Synthesis:**

- Every Sunday evening, AI generates:
  - "Week in Review" report
  - Problems solved vs. attempted
  - New patterns learned
  - Breakthrough moments highlighted
  - Next week's focus area

**Monthly Deep Dive:**

- Comprehensive learning report:
  - Skill radar chart (visualization of competencies)
  - Learning velocity graph
  - Comparison with similar learners (anonymized)
  - Personalized curriculum for next month

**Yearly Reflection:**

- "Your Year in Code" narrative:
  - AI writes a story of the user's learning journey
  - Highlights memorable problems
  - Shows growth trajectory
  - Sets annual goals collaboratively

### 3.5 Social Interaction & Discussion

**Problem Discussion Flow:**

**Viewing Discussions:**

1. User scrolls below problem description
2. Sees community discussion thread
3. Comments sorted by AI relevance (not just votes)

**Posting a Hint:**

1. User clicks "Share Insight"
2. Writes hint in markdown editor
3. AI scans for spoilers: "This might reveal too much. Consider rephrasing..."
4. User refines and posts
5. AI tags hint with relevant concepts

**Seeking Help:**

1. User posts: "I'm stuck on understanding why my greedy approach fails"
2. AI immediately suggests:
   - Similar questions in discussion
   - Related problems user has solved
   - Relevant educational resources
3. Community members notified if they've solved this problem
4. AI synthesizes community responses into structured advice

---

## 4. Functional Requirements (Detailed)

### 4.1 Authentication & Authorization

**4.1.1 User Registration**

- **FR-AUTH-001:** Support email/password registration
- **FR-AUTH-002:** Email verification via token link
- **FR-AUTH-003:** Password requirements: min 8 chars, 1 uppercase, 1 number
- **FR-AUTH-004:** Optional OAuth (Google, GitHub) for future phases

**4.1.2 User Roles**

- **FR-AUTH-005:** Two roles: User (default), Admin
- **FR-AUTH-006:** Role-based route protection
- **FR-AUTH-007:** Admin can promote users to Admin role

**4.1.3 Session Management**

- **FR-AUTH-008:** JWT-based authentication
- **FR-AUTH-009:** 7-day token expiry with refresh mechanism
- **FR-AUTH-010:** Secure HTTP-only cookies for token storage

### 4.2 Problem Library

**4.2.1 Problem Discovery**

- **FR-PROB-001:** Landing page displays problem grid
- **FR-PROB-002:** Each card shows: title, difficulty, category, acceptance rate
- **FR-PROB-003:** Filter by: difficulty (Easy/Medium/Hard), category, status (solved/unsolved)
- **FR-PROB-004:** Sort by: difficulty, acceptance rate, recent activity
- **FR-PROB-005:** Search by problem title or tags

**4.2.2 Problem Categories**

- Arrays
- Strings
- Hash Maps
- Trees & Graphs
- Dynamic Programming
- Greedy Algorithms
- Backtracking
- Math & Number Theory
- Bit Manipulation
- Sorting & Searching

**4.2.3 Problem Metadata**

- **FR-PROB-006:** Each problem has:
  - Unique ID
  - Title
  - Difficulty (Easy: 1-3, Medium: 4-6, Hard: 7-10)
  - Category tags (multiple allowed)
  - Acceptance rate (calculated from submissions)
  - Created date
  - Author (Admin who created it)

### 4.3 Problem Detail Page

**4.3.1 Content Structure**

- **FR-DETAIL-001:** Problem description (supports markdown)
- **FR-DETAIL-002:** Input format specification
- **FR-DETAIL-003:** Output format specification
- **FR-DETAIL-004:** Constraints section
- **FR-DETAIL-005:** Sample inputs/outputs (minimum 2 examples)
- **FR-DETAIL-006:** Editorial section (visible only after solving)

**4.3.2 Test Cases**

- **FR-DETAIL-007:** Visible test cases (shown in problem)
- **FR-DETAIL-008:** Hidden test cases (used for evaluation)
- **FR-DETAIL-009:** Admin can add/edit/delete test cases
- **FR-DETAIL-010:** Test cases include: input, expected output, test case weight

### 4.4 Integrated Code Editor

**4.4.1 Editor Features**

- **FR-EDITOR-001:** Browser-based code editor (Monaco Editor recommended)
- **FR-EDITOR-002:** Syntax highlighting for supported languages
- **FR-EDITOR-003:** Auto-indentation and bracket matching
- **FR-EDITOR-004:** Code persistence (auto-save to local storage every 30s)
- **FR-EDITOR-005:** Theme toggle (light/dark)

**4.4.2 Language Support (MVP)**

- **FR-EDITOR-006:** Support for: Python, JavaScript, C++, Java
- **FR-EDITOR-007:** Language selector dropdown
- **FR-EDITOR-008:** Default code template per language

**4.4.3 Custom Input Testing**

- **FR-EDITOR-009:** "Run" button executes code with custom input
- **FR-EDITOR-010:** Custom input text area below editor
- **FR-EDITOR-011:** Output display shows: stdout, stderr, execution time
- **FR-EDITOR-012:** Error messages displayed with line numbers

### 4.5 Secure Code Execution

**4.5.1 Execution Engine Integration**

- **FR-EXEC-001:** Integrate with Judge0 CE or Piston API
- **FR-EXEC-002:** Support execution timeout (5 seconds for "Run", 10 seconds for "Submit")
- **FR-EXEC-003:** Memory limit enforcement (256 MB)
- **FR-EXEC-004:** Sandboxed execution environment

**4.5.2 Run Mode (Custom Input)**

- **FR-EXEC-005:** Send: source code, language, custom input
- **FR-EXEC-006:** Return: stdout, stderr, execution time, memory used
- **FR-EXEC-007:** Handle compilation errors gracefully

**4.5.3 Submit Mode (Evaluation)**

- **FR-EXEC-008:** Execute code against all hidden test cases sequentially
- **FR-EXEC-009:** Stop execution on first failure (optional: run all tests)
- **FR-EXEC-010:** Return verdict: Accepted, Wrong Answer, TLE, Runtime Error, Compilation Error
- **FR-EXEC-011:** For failures, indicate which test case failed (not the data)

### 4.6 Submission System

**4.6.1 Submission Workflow**

- **FR-SUB-001:** "Submit" button triggers evaluation flow
- **FR-SUB-002:** Loading state during evaluation (estimated time)
- **FR-SUB-003:** Verdict displayed prominently with color coding
- **FR-SUB-004:** Execution statistics: time, memory, test cases passed

**4.6.2 Submission Storage**

- **FR-SUB-005:** Store: user ID, problem ID, code, language, timestamp, verdict
- **FR-SUB-006:** Immutable after submission
- **FR-SUB-007:** Users can view submission history per problem
- **FR-SUB-008:** Submission detail page shows: code, verdict, test results

**4.6.3 Submission States**

- Pending: In queue
- Running: Executing tests
- Accepted: All tests passed
- Wrong Answer: Output mismatch
- Time Limit Exceeded: Execution timeout
- Runtime Error: Crash or exception
- Compilation Error: Code didn't compile

### 4.7 Activity Tracking

**4.7.1 Streak Counter**

- **FR-TRACK-001:** Track consecutive days with ≥1 Accepted submission
- **FR-TRACK-002:** Display current streak on dashboard
- **FR-TRACK-003:** Display best streak (all-time record)
- **FR-TRACK-004:** Reset at midnight in user's timezone
- **FR-TRACK-005:** "Freeze" feature: maintain streak with single skip token (future)

**4.7.2 Activity Heatmap**

- **FR-TRACK-006:** GitHub-style calendar heatmap on profile
- **FR-TRACK-007:** Color intensity based on submission count per day
- **FR-TRACK-008:** Hover shows exact count and date
- **FR-TRACK-009:** Display last 365 days
- **FR-TRACK-010:** Click day to see submissions made that day

### 4.8 Analytics Dashboard

**4.8.1 User Statistics**

- **FR-ANALYTICS-001:** Total problems solved (by difficulty)
- **FR-ANALYTICS-002:** Total submissions made
- **FR-ANALYTICS-003:** Acceptance rate (% of submissions that passed)
- **FR-ANALYTICS-004:** Average time to solve per difficulty
- **FR-ANALYTICS-005:** Category breakdown (pie chart or bar chart)

**4.8.2 Visual Analytics**

- **FR-ANALYTICS-006:** Skill radar chart (8 categories, 0-100 scale)
- **FR-ANALYTICS-007:** Submission timeline graph (last 30 days)
- **FR-ANALYTICS-008:** Difficulty distribution of solved problems
- **FR-ANALYTICS-009:** Learning velocity curve (problems/week over time)

**4.8.3 Comparative Analytics**

- **FR-ANALYTICS-010:** Percentile ranking among all users
- **FR-ANALYTICS-011:** Comparison with users who joined same month
- **FR-ANALYTICS-012:** Average solve time vs. platform average

### 4.9 Social Features (Baseline)

**4.9.1 Discussion Threads**

- **FR-SOCIAL-001:** Each problem has a discussion section
- **FR-SOCIAL-002:** Users can post comments (markdown supported)
- **FR-SOCIAL-003:** Threaded replies (one level deep)
- **FR-SOCIAL-004:** Upvote/downvote comments
- **FR-SOCIAL-005:** Sort by: most helpful, newest, AI-recommended

**4.9.2 Hint System**

- **FR-SOCIAL-006:** Users can post hints with spoiler tags
- **FR-SOCIAL-007:** Hints categorized: approach hint, optimization hint, edge case hint
- **FR-SOCIAL-008:** AI scans hints for excessive spoilers
- **FR-SOCIAL-009:** Users can flag inappropriate hints

**4.9.3 External Platform Integration**

- **FR-SOCIAL-010:** Users can link GitHub profile
- **FR-SOCIAL-011:** Display GitHub contribution graph alongside Mentat heatmap
- **FR-SOCIAL-012:** Link LeetCode/Codeforces profiles (read-only, for context)

### 4.10 Admin Problem Management

**4.10.1 Problem Creation**

- **FR-ADMIN-001:** Admin-only "Create Problem" interface
- **FR-ADMIN-002:** Rich text editor for problem description
- **FR-ADMIN-003:** Add sample test cases (visible)
- **FR-ADMIN-004:** Add hidden test cases (evaluation)
- **FR-ADMIN-005:** Set difficulty and category tags
- **FR-ADMIN-006:** Preview problem before publishing

**4.10.2 Problem Editing**

- **FR-ADMIN-007:** Edit existing problems
- **FR-ADMIN-008:** Version history for problem changes
- **FR-ADMIN-009:** Flag problems as "Draft" or "Published"
- **FR-ADMIN-010:** Bulk import problems from JSON

**4.10.3 Test Case Management**

- **FR-ADMIN-011:** Add/edit/delete individual test cases
- **FR-ADMIN-012:** Validate test cases (run against reference solution)
- **FR-ADMIN-013:** Set test case weights for partial scoring (future)

---

## 5. AI System Design (Most Critical Section)

This section provides a comprehensive, step-by-step guide to building the AI-powered learning intelligence system.

### 5.1 AI Product Goals

**Why Simple LLM Calls Are Insufficient:**

A naive approach would call OpenAI API with:

```
prompt = f"Explain why this code failed: {user_code}"
```

**Problems with this approach:**

1. **No Memory:** AI doesn't know user's history, learning patterns, or past mistakes
2. **No Context:** Missing information about problem difficulty, user's skill level, time of day
3. **Generic Output:** Same feedback for beginner vs. advanced user
4. **No Learning:** AI can't improve recommendations over time
5. **No Orchestration:** Can't coordinate multiple analyses (code review + learning path + motivation)

**Our AI System Goals:**

1. **Persistent Memory:** Remember every interaction, building a comprehensive user learning profile
2. **Contextual Intelligence:** Factor in user history, current trajectory, and optimal next steps
3. **Adaptive Feedback:** Tailor communication style, depth, and examples to individual needs
4. **Proactive Guidance:** Anticipate struggles and intervene before frustration
5. **Multi-Dimensional Analysis:** Simultaneously analyze code quality, learning gaps, and motivation state

### 5.2 RAG Pipeline Architecture (Step-by-Step Implementation)

**RAG (Retrieval-Augmented Generation) Explained:**

RAG combines a vector database (long-term memory) with LLM generation:

1. Store all relevant context as embeddings in a vector database
2. When user needs feedback, retrieve most relevant historical data
3. Combine retrieved context with current query
4. Send enriched prompt to LLM
5. LLM generates response using both retrieved memory and its training

**5.2.1 Data Sources for RAG**

The system must capture and embed:

| Data Type                | Content                                             | Purpose                             |
| ------------------------ | --------------------------------------------------- | ----------------------------------- |
| **Submissions**          | Code, language, verdict, timestamp, execution stats | Track coding patterns and evolution |
| **AI Feedback History**  | Previous feedback given, user reactions             | Avoid repetition, learn what works  |
| **Problem Interactions** | Read time, attempts, hints viewed                   | Understand struggle points          |
| **Learning Events**      | Breakthroughs, plateaus, milestone achievements     | Personalize motivation              |
| **Discussion Activity**  | Questions asked, hints given, community engagement  | Gauge communication style           |
| **External Context**     | Time of day, streak status, recent activity pattern | Optimize intervention timing        |

**5.2.2 Vector Store Design**

**Recommended Technology:** Pinecone, Weaviate, or Qdrant

**Schema Design:**

```
Collection: user_learning_memory

Vector Entry Structure:
{
  "id": "submission_12345",
  "vector": [0.234, -0.123, ...], // 1536-dim embedding
  "metadata": {
    "user_id": "user_789",
    "problem_id": "problem_42",
    "problem_difficulty": 5,
    "problem_category": "dynamic_programming",
    "submission_date": "2026-01-10T14:23:00Z",
    "verdict": "wrong_answer",
    "language": "python",
    "execution_time_ms": 1234,
    "code_snippet": "def solve(nums): ...",
    "ai_feedback_given": true,
    "user_engagement_score": 0.85,
    "learning_phase": "intermediate_dp"
  }
}
```

**Collections to Maintain:**

1. **user_submissions:** Every code submission with embeddings
2. **ai_feedback_history:** Every AI interaction
3. **problem_knowledge:** Problem descriptions, editorial, patterns
4. **learning_concepts:** Canonical explanations of algorithms/patterns
5. **user_breakthroughs:** Significant learning moments

**5.2.3 Embedding Strategy**

**Text to Embed:**

For each submission, create a composite text representation:

```python
def create_submission_embedding_text(submission):
    """
    Combine all relevant context into a single text for embedding
    """
    text = f"""
    User: {submission.user_id}
    Problem: {submission.problem_title} (Difficulty: {submission.difficulty})
    Category: {submission.problem_category}
    Verdict: {submission.verdict}
    Language: {submission.language}

    Code Summary:
    {extract_code_summary(submission.code)}

    Execution Context:
    - Time: {submission.execution_time_ms}ms
    - Memory: {submission.memory_used_kb}KB
    - Attempt Number: {submission.attempt_number}

    User State:
    - Current Streak: {submission.user_streak}
    - Recent Success Rate: {submission.recent_success_rate}
    - Learning Velocity: {submission.learning_velocity}

    Contextual Notes:
    {submission.ai_generated_notes}
    """
    return text

def extract_code_summary(code):
    """
    Use LLM to summarize code approach (not full code)
    """
    prompt = f"In 2 sentences, describe the algorithmic approach: {code}"
    summary = llm_call(prompt, max_tokens=100)
    return summary
```

**Embedding Model:**

- **Recommended:** OpenAI `text-embedding-3-large` (3072-dim) or `text-embedding-3-small` (1536-dim)
- **Alternative:** Cohere `embed-english-v3.0` or open-source `all-MiniLM-L6-v2`

**Implementation:**

```python
import openai

def generate_embedding(text):
    """
    Generate vector embedding for text
    """
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

# Store in vector DB
def store_submission_memory(submission):
    embedding_text = create_submission_embedding_text(submission)
    vector = generate_embedding(embedding_text)

    pinecone_index.upsert([
        {
            "id": f"sub_{submission.id}",
            "values": vector,
            "metadata": {
                "user_id": submission.user_id,
                "problem_id": submission.problem_id,
                # ... all metadata
            }
        }
    ])
```

**5.2.4 Retrieval Logic**

**Query Construction:**

When user requests AI feedback, construct a query embedding:

```python
def create_feedback_query(submission, user_context):
    """
    Create query to retrieve relevant historical context
    """
    query_text = f"""
    User {user_context.user_id} just submitted code for problem {submission.problem_title}.
    Verdict: {submission.verdict}

    Retrieve similar past experiences where:
    - User struggled with similar patterns
    - User solved similar problems successfully
    - AI feedback was particularly helpful

    Focus on: {submission.problem_category} problems at difficulty {submission.difficulty}
    """
    return generate_embedding(query_text)
```

**Retrieval Parameters:**

```python
def retrieve_relevant_context(query_vector, user_id, top_k=5):
    """
    Retrieve most relevant historical context
    """
    results = pinecone_index.query(
        vector=query_vector,
        filter={
            "user_id": {"$eq": user_id}
        },
        top_k=top_k,
        include_metadata=True
    )
    return results
```

**Contextual Filtering:**

Apply intelligent filters:

- **Recency Bias:** Weight recent submissions higher
- **Pattern Relevance:** Prioritize similar problem categories
- **Success Patterns:** Include successful approaches user has used
- **Struggle Points:** Surface repeated failure patterns

**5.2.5 Context Construction**

**Building the LLM Context:**

```python
def construct_llm_context(current_submission, retrieved_memories):
    """
    Combine current submission with retrieved historical context
    """
    context = {
        "current_submission": {
            "problem": current_submission.problem_title,
            "code": current_submission.code,
            "verdict": current_submission.verdict,
            "attempt_number": current_submission.attempt_count
        },
        "historical_context": [],
        "user_profile": {}
    }

    # Add retrieved memories
    for memory in retrieved_memories:
        context["historical_context"].append({
            "past_problem": memory.metadata["problem_title"],
            "past_verdict": memory.metadata["verdict"],
            "ai_feedback_given": memory.metadata["ai_feedback"],
            "user_reaction": memory.metadata["engagement_score"],
            "similarity_score": memory.score
        })

    # Add user learning profile
    context["user_profile"] = {
        "total_solved": get_user_stats(current_submission.user_id)["solved_count"],
        "current_streak": get_user_streak(current_submission.user_id),
        "strong_categories": get_user_strengths(current_submission.user_id),
        "weak_categories": get_user_weaknesses(current_submission.user_id),
        "learning_velocity": calculate_learning_velocity(current_submission.user_id)
    }

    return context
```

**5.2.6 Prompt Assembly**

**Structured Prompt Template:**

````python
def assemble_feedback_prompt(context):
    """
    Create comprehensive prompt for LLM
    """
    prompt = f"""
You are a Mentat—a master teacher with perfect memory of this learner's journey.

## Current Situation
**Problem:** {context["current_submission"]["problem"]}
**Verdict:** {context["current_submission"]["verdict"]}
**Attempt:** #{context["current_submission"]["attempt_number"]}

**User's Code:**
```{context["current_submission"]["language"]}
{context["current_submission"]["code"]}
````

## Historical Context (Your Memory)

{format_historical_context(context["historical_context"])}

## Learner Profile

- Total Problems Solved: {context["user_profile"]["total_solved"]}
- Current Streak: {context["user_profile"]["current_streak"]} days
- Strong Areas: {", ".join(context["user_profile"]["strong_categories"])}
- Growth Areas: {", ".join(context["user_profile"]["weak_categories"])}
- Learning Velocity: {context["user_profile"]["learning_velocity"]} problems/week

## Your Task

Provide feedback that:

1. References specific past experiences when relevant
2. Adapts to their learning phase (beginner/intermediate/advanced)
3. Balances encouragement with technical depth
4. Suggests ONE concrete next step
5. Is concise (max 200 words)

If the code failed, explain WHY without giving the full solution.
If the code passed but is non-optimal, explain the optimization opportunity.
If this is a repeated struggle pattern, acknowledge it and provide strategic guidance.

Remember: You're building a long-term relationship. Every interaction shapes their growth trajectory.
"""
return prompt

def format_historical_context(memories):
"""Format retrieved memories for prompt"""
if not memories:
return "This is your first interaction with this type of problem."

    formatted = []
    for mem in memories[:3]:  # Top 3 most relevant
        formatted.append(f"- {mem['past_problem']}: {mem['past_verdict']} (similarity: {mem['similarity_score']:.2f})")

    return "\n".join(formatted)

````

**5.2.7 Output Validation**

**Response Quality Checks:**

```python
def validate_ai_feedback(feedback_text, context):
    """
    Ensure AI feedback meets quality standards
    """
    checks = {
        "length_appropriate": 50 < len(feedback_text.split()) < 250,
        "no_complete_solution": not contains_full_solution(feedback_text, context["current_submission"]["code"]),
        "actionable": contains_actionable_advice(feedback_text),
        "personalized": references_user_context(feedback_text, context),
        "tone_appropriate": check_tone(feedback_text, context["user_profile"]["learning_phase"])
    }

    if not all(checks.values()):
        # Log failure and retry with modified prompt
        failed_checks = [k for k, v in checks.items() if not v]
        return regenerate_feedback(context, constraints=failed_checks)

    return feedback_text

def contains_full_solution(feedback, user_code):
    """Detect if AI is giving away the solution"""
    # Use simple heuristics or another LLM call
    check_prompt = f"""
    Does this feedback reveal the complete solution?
    Feedback: {feedback}
    Return only: YES or NO
    """
    result = llm_call(check_prompt, max_tokens=5)
    return "YES" in result.upper()
````

**Feedback Storage:**

```python
def store_feedback_interaction(submission_id, feedback_text, user_reaction=None):
    """
    Store feedback in vector DB for future retrieval
    """
    feedback_embedding_text = f"""
    Feedback for problem: {submission.problem_title}
    User state: {submission.user_learning_phase}
    Feedback: {feedback_text}
    User engagement: {user_reaction or 'pending'}
    """

    vector = generate_embedding(feedback_embedding_text)

    pinecone_index.upsert([{
        "id": f"feedback_{submission_id}",
        "values": vector,
        "metadata": {
            "submission_id": submission_id,
            "feedback_text": feedback_text,
            "user_reaction": user_reaction,
            "timestamp": datetime.now().isoformat()
        }
    }])
```

### 5.3 Agentic Workflow Design

**Why Multi-Agent Architecture?**

A single AI model cannot simultaneously:

- Analyze code quality
- Recommend next problems
- Calibrate difficulty
- Provide motivation
- Generate reports

Instead, we deploy specialized agents that collaborate:

**5.3.1 Agent Architecture Overview**

```
┌─────────────────────────────────────────────────────────┐
│                   Agent Orchestrator                     │
│              (LangGraph State Machine)                   │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Feedback   │  │ Learning Path│  │  Difficulty  │
│    Agent     │  │    Agent     │  │ Calibration  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                  ┌──────────────┐
                  │  Motivation  │
                  │    Agent     │
                  └──────────────┘
                           │
                           ▼
                  ┌──────────────┐
                  │  Analytics   │
                  │ Report Agent │
                  └──────────────┘
```

**5.3.2 Feedback Agent**

**Responsibility:** Provide immediate, contextual code analysis

**Inputs:**

- Current submission (code, verdict, execution stats)
- Retrieved historical context (from RAG)
- User learning profile
- Problem metadata

**Process:**

1. Analyze code structure and approach
2. Identify specific issues (if failed)
3. Compare with optimal solutions
4. Formulate feedback adhering to user's learning level
5. Validate output quality

**Outputs:**

- Structured feedback object:
  ```json
  {
    "feedback_type": "wrong_answer_analysis",
    "main_message": "Your nested loop approach times out for large inputs...",
    "technical_detail": "Current complexity: O(n²), optimal: O(n)",
    "hint": "Consider using a hash map to track seen elements",
    "related_concept": "Two Pointer Technique",
    "confidence": 0.92
  }
  ```

**Implementation:**

```python
from langchain.agents import Agent
from langchain.prompts import PromptTemplate

class FeedbackAgent(Agent):
    def __init__(self, llm, vector_store):
        self.llm = llm
        self.vector_store = vector_store

    async def analyze_submission(self, submission, user_context):
        # Step 1: Retrieve relevant context
        query_vector = self.create_query_embedding(submission)
        memories = self.vector_store.query(query_vector, top_k=5)

        # Step 2: Construct prompt
        context = self.build_context(submission, memories, user_context)
        prompt = self.assemble_prompt(context)

        # Step 3: Generate feedback
        response = await self.llm.agenerate([prompt])
        feedback = self.parse_response(response)

        # Step 4: Validate
        validated_feedback = self.validate(feedback, context)

        # Step 5: Store for future retrieval
        self.store_feedback(submission.id, validated_feedback)

        return validated_feedback

    def create_query_embedding(self, submission):
        query_text = f"""
        Problem: {submission.problem_title}
        Category: {submission.category}
        Verdict: {submission.verdict}
        User approach: {self.summarize_code(submission.code)}
        """
        return generate_embedding(query_text)
```

**5.3.3 Learning Path Agent**

**Responsibility:** Recommend optimal next problems based on growth trajectory

**Inputs:**

- User's complete submission history
- Current skill radar (strengths/weaknesses)
- Learning velocity metrics
- Available problems database
- User goals (if set)

**Decision Logic:**

```python
class LearningPathAgent(Agent):
    def __init__(self, llm, vector_store, problem_db):
        self.llm = llm
        self.vector_store = vector_store
        self.problem_db = problem_db

    async def recommend_next_problem(self, user_id):
        # Step 1: Analyze current state
        user_profile = self.get_comprehensive_profile(user_id)

        # Step 2: Identify learning gaps
        gaps = self.identify_skill_gaps(user_profile)

        # Step 3: Determine optimal challenge level
        target_difficulty = self.calculate_optimal_difficulty(user_profile)

        # Step 4: Filter candidate problems
        candidates = self.problem_db.filter(
            category=gaps[0]["category"],  # Focus on weakest area
            difficulty_range=(target_difficulty - 1, target_difficulty + 1),
            not_attempted_by=user_id
        )

        # Step 5: Rank candidates using AI
        ranked = await self.rank_problems(candidates, user_profile)

        # Step 6: Return top recommendation with reasoning
        return {
            "problem": ranked[0],
            "reasoning": self.explain_recommendation(ranked[0], user_profile),
            "expected_difficulty": target_difficulty,
            "learning_objective": gaps[0]["category"]
        }

    def identify_skill_gaps(self, user_profile):
        """Find categories where user struggles most"""
        category_stats = user_profile["category_performance"]

        gaps = []
        for category, stats in category_stats.items():
            if stats["success_rate"] < 0.5:  # Less than 50% success
                gaps.append({
                    "category": category,
                    "severity": 1 - stats["success_rate"],
                    "attempts": stats["total_attempts"]
                })

        return sorted(gaps, key=lambda x: x["severity"], reverse=True)

    def calculate_optimal_difficulty(self, user_profile):
        """
        Determine challenge level using flow theory
        Too easy = boredom, too hard = frustration
        """
        recent_performance = user_profile["recent_submissions"][-10:]

        avg_difficulty_solved = np.mean([
            s["difficulty"] for s in recent_performance if s["verdict"] == "accepted"
        ])

        success_rate = len([s for s in recent_performance if s["verdict"] == "accepted"]) / len(recent_performance)

        # Adjust based on success rate
        if success_rate > 0.8:
            # User is succeeding too easily, increase difficulty
            return min(10, avg_difficulty_solved + 1)
        elif success_rate < 0.3:
            # User is struggling, decrease difficulty
            return max(1, avg_difficulty_solved - 1)
        else:
            # Goldilocks zone, maintain difficulty
            return avg_difficulty_solved

    async def rank_problems(self, candidates, user_profile):
        """Use LLM to rank problems by learning value"""
        ranking_prompt = f"""
You are optimizing a learning path for a programmer.

User Profile:
- Strong in: {user_profile["strengths"]}
- Weak in: {user_profile["weaknesses"]}
- Recent success rate: {user_profile["recent_success_rate"]}
- Learning style: {user_profile["learning_style"]}

Candidate Problems:
{self.format_problems(candidates)}

Rank these problems (1 = best for learning) based on:
1. Addresses current weakness
2. Builds on recent successes
3. Introduces new concepts gradually
4. Maintains engagement

Return JSON: [{{"problem_id": "...", "rank": 1, "reasoning": "..."}}, ...]
"""

        response = await self.llm.agenerate([ranking_prompt])
        ranked = json.loads(response.generations[0][0].text)

        return sorted(ranked, key=lambda x: x["rank"])
```

**5.3.4 Difficulty Calibration Agent**

**Responsibility:** Dynamically adjust problem difficulty ratings based on actual solver data

**Why This Matters:**

- Problem setters may misjudge difficulty
- Difficulty is relative to solver population
- Some "easy" problems have hidden complexity

**Process:**

```python
class DifficultyCalibrationAgent(Agent):
    def __init__(self, llm, submission_db):
        self.llm = llm
        self.submission_db = submission_db

    async def calibrate_problem_difficulty(self, problem_id):
        # Step 1: Gather submission statistics
        submissions = self.submission_db.get_all_for_problem(problem_id)

        stats = {
            "total_attempts": len(submissions),
            "unique_solvers": len(set(s.user_id for s in submissions)),
            "acceptance_rate": self.calculate_acceptance_rate(submissions),
            "avg_attempts_to_solve": self.avg_attempts(submissions),
            "avg_time_to_solve": self.avg_time(submissions),
            "solver_skill_distribution": self.get_solver_skills(submissions)
        }

        # Step 2: Analyze patterns
        difficulty_indicators = {
            "acceptance_rate": stats["acceptance_rate"],  # Lower = harder
            "avg_attempts": stats["avg_attempts_to_solve"],  # More = harder
            "solver_skill": np.mean(stats["solver_skill_distribution"]),  # Higher skill = harder
            "time_to_solve": stats["avg_time_to_solve"]  # Longer = harder (with ceiling)
        }

        # Step 3: Use AI to synthesize difficulty score
        calibration_prompt = f"""
Analyze this problem's actual difficulty based on solver data:

Problem: {problem_id}
Current Rated Difficulty: {self.get_current_rating(problem_id)}

Solver Statistics:
- Acceptance Rate: {stats["acceptance_rate"]:.1%}
- Average Attempts to Solve: {stats["avg_attempts_to_solve"]:.1f}
- Average Solver Skill Level: {difficulty_indicators["solver_skill"]:.1f}/10
- Average Time to Solve: {stats["avg_time_to_solve"]:.0f} minutes

For reference:
- Easy problems: 70%+ acceptance, <2 attempts, <15 min
- Medium problems: 40-70% acceptance, 2-4 attempts, 15-40 min
- Hard problems: <40% acceptance, >4 attempts, >40 min

Recommend difficulty rating (1-10) with reasoning.
Return JSON: {{"difficulty": X, "confidence": Y, "reasoning": "..."}}
"""

        response = await self.llm.agenerate([calibration_prompt])
        calibration = json.loads(response.generations[0][0].text)

        # Step 4: Update problem difficulty if confidence is high
        if calibration["confidence"] > 0.8:
            self.update_problem_difficulty(problem_id, calibration["difficulty"])

        return calibration
```

**5.3.5 Motivation & Streak Agent**

**Responsibility:** Maintain user engagement through personalized encouragement

**Psychological Principles:**

- Loss aversion (streak preservation)
- Variable rewards (unexpected achievements)
- Progress visibility (milestones)
- Social proof (peer comparisons)

**Implementation:**

```python
class MotivationAgent(Agent):
    def __init__(self, llm, user_db):
        self.llm = llm
        self.user_db = user_db

    async def generate_motivational_message(self, user_id, trigger_event):
        user_context = self.get_motivation_context(user_id)

        # Different strategies based on user state
        if trigger_event == "streak_at_risk":
            return await self.streak_preservation_message(user_context)
        elif trigger_event == "plateau_detected":
            return await self.plateau_breakthrough_message(user_context)
        elif trigger_event == "achievement_unlocked":
            return await self.celebration_message(user_context)
        elif trigger_event == "consecutive_failures":
            return await self.resilience_message(user_context)
        else:
            return await self.general_encouragement(user_context)

    async def streak_preservation_message(self, user_context):
        prompt = f"""
Generate a brief, personalized message to encourage streak preservation.

User Context:
- Current Streak: {user_context["current_streak"]} days
- Best Streak: {user_context["best_streak"]} days
- Last Activity: {user_context["hours_since_last_activity"]} hours ago
- Personality: {user_context["personality_type"]}

Tone Guidelines:
- {self.get_tone_for_personality(user_context["personality_type"])}
- Max 30 words
- Include specific streak numbers
- Create gentle urgency without pressure

Return only the message text.
"""

        response = await self.llm.agenerate([prompt])
        return response.generations[0][0].text.strip()

    async def plateau_breakthrough_message(self, user_context):
        """When user is stuck at same level"""
        prompt = f"""
User has solved {user_context["problems_at_current_level"]} problems at difficulty {user_context["current_difficulty"]}
but hasn't attempted harder problems.

Success rate: {user_context["recent_success_rate"]:.0%}

Generate encouragement to attempt next difficulty level.
- Acknowledge current mastery
- Create confidence in readiness
- Suggest specific next challenge
- Max 50 words
"""

        response = await self.llm.agenerate([prompt])
        return response.generations[0][0].text.strip()

    def get_tone_for_personality(self, personality_type):
        """Adapt communication style to user personality"""
        tones = {
            "achiever": "Use achievement language, compare to goals",
            "explorer": "Emphasize learning and discovery",
            "competitor": "Reference rankings and challenges",
            "supporter": "Focus on community and helping others"
        }
        return tones.get(personality_type, "Balanced and encouraging")

    def detect_personality_type(self, user_id):
        """Infer personality from behavior patterns"""
        behavior = self.user_db.get_behavior_metrics(user_id)

        # Simple heuristic (can be enhanced with ML)
        if behavior["goal_setting_frequency"] > 0.7:
            return "achiever"
        elif behavior["diverse_problem_attempts"] > 0.8:
            return "explorer"
        elif behavior["discussion_participation"] > 0.6:
            return "supporter"
        else:
            return "competitor"
```

**5.3.6 Analytics & Report Agent**

**Responsibility:** Generate comprehensive learning reports (weekly/monthly)

**Report Structure:**

```python
class AnalyticsReportAgent(Agent):
    def __init__(self, llm, analytics_db):
        self.llm = llm
        self.analytics_db = analytics_db

    async def generate_weekly_report(self, user_id):
        # Step 1: Gather weekly data
        week_data = self.analytics_db.get_week_data(user_id)

        # Step 2: Calculate metrics
        metrics = {
            "problems_solved": week_data["solved_count"],
            "problems_attempted": week_data["attempt_count"],
            "success_rate": week_data["solved_count"] / max(week_data["attempt_count"], 1),
            "category_breakdown": week_data["category_stats"],
            "difficulty_progression": week_data["difficulty_trend"],
            "learning_velocity": self.calculate_velocity(week_data),
            "breakthrough_moment": self.identify_breakthrough(week_data),
            "consistent_struggle": self.identify_struggles(week_data)
        }

        # Step 3: Generate narrative report
        report_prompt = f"""
Create a personalized weekly learning report for a programmer.

This Week's Data:
- Problems Solved: {metrics["problems_solved"]}
- Success Rate: {metrics["success_rate"]:.0%}
- Main Focus: {max(metrics["category_breakdown"], key=metrics["category_breakdown"].get)}
- Difficulty Trend: {metrics["difficulty_progression"]}

Insights:
- Breakthrough: {metrics["breakthrough_moment"]}
- Challenge Area: {metrics["consistent_struggle"]}

Generate a report with:
1. Opening (acknowledge effort)
2. Key Achievement (highlight best moment)
3. Growth Area (constructive, specific)
4. Next Week Strategy (actionable recommendations)

Tone: Mentorship, data-driven, encouraging
Length: 200-250 words
"""

        response = await self.llm.agenerate([report_prompt])
        narrative = response.generations[0][0].text

        # Step 4: Combine narrative with visualizations
        report = {
            "period": "week",
            "narrative": narrative,
            "metrics": metrics,
            "visualizations": {
                "activity_heatmap": week_data["daily_activity"],
                "category_pie_chart": metrics["category_breakdown"],
                "difficulty_line_graph": metrics["difficulty_progression"]
            },
            "recommendations": await self.generate_recommendations(metrics)
        }

        return report

    def identify_breakthrough(self, week_data):
        """Find the most significant positive moment"""
        submissions = week_data["submissions"]

        # Look for first-time success on previously failed problems
        for submission in submissions:
            if submission["verdict"] == "accepted":
                past_attempts = [s for s in submissions if s["problem_id"] == submission["problem_id"] and s["timestamp"] < submission["timestamp"]]
                if len(past_attempts) >= 3:
                    return f"Solved {submission['problem_title']} after {len(past_attempts)} attempts"

        # Look for difficulty jump
        difficulties = [s["difficulty"] for s in submissions if s["verdict"] == "accepted"]
        if difficulties:
            max_difficulty = max(difficulties)
            if max_difficulty > week_data["previous_max_difficulty"]:
                return f"Conquered first difficulty-{max_difficulty} problem"

        return "Maintained consistent progress"

    async def generate_recommendations(self, metrics):
        """AI-generated personalized recommendations"""
        rec_prompt = f"""
Based on this week's performance, suggest 3 specific actions for next week.

Metrics:
- Success Rate: {metrics["success_rate"]:.0%}
- Strong Category: {max(metrics["category_breakdown"], key=metrics["category_breakdown"].get)}
- Weak Category: {min(metrics["category_breakdown"], key=metrics["category_breakdown"].get)}

Each recommendation should:
1. Be specific (name actual problem types or techniques)
2. Be achievable in 1 week
3. Build on strengths while addressing weaknesses

Return JSON array: [{{"action": "...", "reasoning": "...", "expected_impact": "..."}}, ...]
"""

        response = await self.llm.agenerate([rec_prompt])
        return json.loads(response.generations[0][0].text)
```

**5.3.7 Agent Orchestration (LangGraph)**

**Orchestrator Design:**

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List

class AgentState(TypedDict):
    """Shared state across all agents"""
    user_id: str
    trigger_event: str
    submission: dict
    context: dict
    feedback: dict
    recommendations: List[dict]
    motivation_message: str
    report: dict

class MentatOrchestrator:
    def __init__(self):
        self.graph = self.build_workflow()

    def build_workflow(self):
        """Define agent execution flow"""
        workflow = StateGraph(AgentState)

        # Define nodes (agents)
        workflow.add_node("feedback_agent", self.run_feedback_agent)
        workflow.add_node("learning_path_agent", self.run_learning_path_agent)
        workflow.add_node("difficulty_calibration", self.run_difficulty_calibration)
        workflow.add_node("motivation_agent", self.run_motivation_agent)
        workflow.add_node("analytics_agent", self.run_analytics_agent)

        # Define edges (execution flow)
        workflow.add_edge("feedback_agent", "learning_path_agent")
        workflow.add_edge("learning_path_agent", "motivation_agent")

        # Conditional edge: only run analytics on weekends
        workflow.add_conditional_edges(
            "motivation_agent",
            self.should_run_analytics,
            {
                True: "analytics_agent",
                False: END
            }
        )

        workflow.add_edge("analytics_agent", END)

        # Set entry point
        workflow.set_entry_point("feedback_agent")

        return workflow.compile()

    async def run_feedback_agent(self, state: AgentState):
        """Execute feedback agent"""
        agent = FeedbackAgent(llm, vector_store)
        feedback = await agent.analyze_submission(state["submission"], state["context"])
        state["feedback"] = feedback
        return state

    async def run_learning_path_agent(self, state: AgentState):
        """Execute learning path agent"""
        agent = LearningPathAgent(llm, vector_store, problem_db)
        recommendations = await agent.recommend_next_problem(state["user_id"])
        state["recommendations"] = recommendations
        return state

    async def run_motivation_agent(self, state: AgentState):
        """Execute motivation agent"""
        agent = MotivationAgent(llm, user_db)
        message = await agent.generate_motivational_message(
            state["user_id"],
            state["trigger_event"]
        )
        state["motivation_message"] = message
        return state

    async def run_analytics_agent(self, state: AgentState):
        """Execute analytics report agent"""
        agent = AnalyticsReportAgent(llm, analytics_db)
        report = await agent.generate_weekly_report(state["user_id"])
        state["report"] = report
        return state

    def should_run_analytics(self, state: AgentState):
        """Determine if analytics should run"""
        return datetime.now().weekday() == 6  # Sunday

    async def process_submission(self, user_id: str, submission: dict):
        """Main entry point for submission processing"""
        initial_state = {
            "user_id": user_id,
            "trigger_event": "submission_completed",
            "submission": submission,
            "context": self.get_user_context(user_id),
            "feedback": {},
            "recommendations": [],
            "motivation_message": "",
            "report": {}
        }

        final_state = await self.graph.ainvoke(initial_state)
        return final_state
```

### 5.4 AI Feedback Types (Detailed Examples)

**5.4.1 Immediate Submission Feedback**

**Scenario: Wrong Answer (First Attempt)**

```python
feedback = {
    "type": "wrong_answer_first_attempt",
    "message": """
I see you're using a nested loop to find pairs that sum to the target.
Let's think about what happens when the input size is 10,000 elements.

Your approach checks every possible pair, which means approximately
50 million comparisons. That's why you're hitting Time Limit Exceeded.

**Hint**: What if you could remember which numbers you've already seen?
Think about a data structure that offers O(1) lookup time.

Try solving this with a single pass through the array.
    """,
    "complexity_analysis": {
        "current": "O(n²)",
        "optimal": "O(n)",
        "space_current": "O(1)",
        "space_optimal": "O(n)"
    },
    "related_concept": "Hash Table / Dictionary",
    "next_step": "Read about the two-pass hash table technique",
    "confidence": 0.94
}
```

**Scenario: Accepted (Non-Optimal)**

```python
feedback = {
    "type": "accepted_non_optimal",
    "message": """
Excellent! Your solution is correct.

I notice you're sorting the array first, which works but adds O(n log n) complexity.
Since you only need to find if a pair exists, there's a more efficient approach.

**What you did well:**
- Clean, readable code
- Handled edge cases correctly
- Good variable naming

**Optimization opportunity:**
The hash table approach solves this in O(n) time without sorting.

Would you like to see how 87% of top solvers approached this problem?
    """,
    "complexity_analysis": {
        "current": "O(n log n)",
        "optimal": "O(n)"
    },
    "percentile": 45,  # User is in 45th percentile for this problem
    "offer_optimal_solution": True
}
```

**5.4.2 Comparative Feedback (Historical)**

**Scenario: User Attempted Similar Problem Before**

```python
feedback = {
    "type": "pattern_recognition",
    "message": """
Interesting! You solved "Valid Anagram" two weeks ago using a hash map to count character frequencies.

This problem ("Group Anagrams") is an extension of that same pattern.

**Connection**: If you can determine whether two strings are anagrams, you can group multiple strings by checking which ones are anagrams of each other.

**Hint**: Think about what makes two strings anagrams. Can you create a "signature" that's identical for all anagrams?

You've already got the building blocks from your previous solution!
    """,
    "related_past_problems": [
        {
            "problem": "Valid Anagram",
            "solved": True,
            "date": "2025-12-28",
            "approach": "character frequency map"
        }
    ],
    "pattern_name": "Frequency Counting → Grouping"
}
```

**5.4.3 Long-Term Learning Insights**

**Scenario: Weekly Progress Summary**

```python
insight = {
    "type": "weekly_synthesis",
    "period": "Jan 6-12, 2026",
    "narrative": """
**Your Week in Code**

You tackled 12 problems this week, solving 9 successfully. That's a 75% success rate—well above your average!

**Breakthrough Moment**
On Wednesday, you conquered "Longest Substring Without Repeating Characters" after 4 attempts.
I noticed you switched from a brute-force approach to a sliding window—that's exactly the kind
of strategic thinking that separates good programmers from great ones.

**Pattern Emerging**
You're becoming confident with hash maps and two-pointer techniques. Your average solve time
for array problems dropped from 32 minutes to 18 minutes.

**Growth Opportunity**
I notice you haven't attempted any tree-based problems yet. Given your strong foundation in
hash tables, you're ready to start exploring binary trees. They use similar recursive thinking
patterns you're already comfortable with.

**Next Week's Focus**
I recommend 3 carefully selected tree problems that build on your existing strengths:
1. "Invert Binary Tree" (introduces tree structure)
2. "Maximum Depth of Binary Tree" (reinforces recursion)
3. "Same Tree" (combines both concepts)

Your learning velocity is accelerating. Keep up the momentum!
    """,
    "metrics": {
        "problems_solved": 9,
        "success_rate": 0.75,
        "avg_solve_time_improvement": -43.75,  # 43.75% faster
        "new_patterns_learned": ["Sliding Window"],
        "mastered_patterns": ["Hash Map", "Two Pointer"]
    }
}
```

**5.4.4 Monthly AI Report**

**Purpose:**
The Monthly AI Report is the most comprehensive and strategic feedback artifact in Mentat Trials. Unlike immediate feedback (tactical) or weekly insights (operational), the monthly report provides a **longitudinal analysis** of learning trajectory, skill development, and strategic growth recommendations. This report leverages the full power of the RAG system to analyze patterns across 30+ days of submissions, identifying macro-trends that are invisible in shorter time windows.

**Generation Trigger:**

- Automatically generated on the 1st of each month
- Available in user dashboard under "Learning Analytics"
- Sent via email as a beautiful HTML digest
- Archived for historical comparison

**AI Agent Responsible:**
**Analytics & Report Agent** (coordinated with Learning Path Agent)

**Data Sources (RAG Context):**

1. **All submissions from the past month** (code, verdicts, timestamps)
2. **Historical monthly reports** (to show year-over-year growth)
3. **Problem metadata** (difficulty, category, common pitfalls)
4. **Peer benchmarking data** (anonymized, for percentile rankings)
5. **Engagement metrics** (streak data, time-of-day patterns, session lengths)
6. **Feedback interactions** (which hints were helpful, which were ignored)

**Report Structure & Content:**

**1. Executive Summary (Natural Language Synthesis)**

- High-level narrative of the month's journey
- Tone: Encouraging, data-backed, forward-looking
- Example: _"You've evolved from a beginner to an intermediate problem solver this month. Your growth trajectory is impressive: 45 problems solved, 68% success rate, and you're now comfortable with 5 core patterns."_

**2. Skill Radar Chart (Visual + Quantitative)**

```python
"skill_radar": {
    "arrays": 8.5/10,           # Strong mastery
    "strings": 7.2/10,          # Proficient
    "hash_maps": 8.8/10,        # Expert level
    "trees": 3.1/10,            # Beginner
    "graphs": 1.5/10,           # Unexplored
    "dynamic_programming": 2.3/10,
    "greedy": 5.4/10,
    "backtracking": 4.0/10
}
```

- Scores calculated using:
  - Success rate in category
  - Average attempts per problem
  - Time-to-solve trends
  - Complexity of problems tackled
- Visual rendering: 8-axis spider chart in UI

**3. Learning Velocity Trend (Week-over-Week)**

```python
"learning_velocity_trend": [
    {"week": 1, "problems": 8, "avg_difficulty": 1.2},
    {"week": 2, "problems": 12, "avg_difficulty": 1.5},
    {"week": 3, "problems": 11, "avg_difficulty": 1.8},
    {"week": 4, "problems": 14, "avg_difficulty": 2.1}
]
```

- Shows consistency and acceleration
- Identifies burnout risks (sudden drops)
- Highlights difficulty progression

**4. Breakthrough Moments (Narrative + Timeline)**

```python
"breakthrough_moments": [
    {
        "date": "2025-12-05",
        "problem": "Two Sum",
        "significance": "First problem solved independently",
        "impact": "Unlocked confidence in hash table approach"
    },
    {
        "date": "2025-12-18",
        "problem": "LRU Cache",
        "significance": "First Medium problem solved without hints",
        "impact": "Demonstrated mastery of linked list + hash map combination"
    },
    {
        "date": "2025-12-27",
        "problem": "Word Ladder",
        "significance": "First graph traversal problem",
        "impact": "Expanded into BFS algorithms"
    }
]
```

- AI identifies "inflection point" submissions
- Criteria: First solve after multiple failures, leap in difficulty, new pattern usage

**5. Struggle Analysis (Constructive Critique)**

```python
"struggle_areas": [
    {
        "category": "Dynamic Programming",
        "attempts": 8,
        "solved": 1,
        "common_error": "Off-by-one errors in DP array initialization",
        "insight": """
You're attempting DP problems before solidifying recursion fundamentals.
I recommend completing the "Recursion Deep Dive" track first.
Your backtracking scores suggest recursive thinking is still developing.
        """,
        "recommended_action": "Pause DP, focus on 10 recursion problems"
    }
]
```

**6. Peer Benchmarking (Percentile Positioning)**

```python
"peer_comparison": {
    "global_percentile": 67,  # Top 33% of all users
    "cohort_percentile": 58,  # Among users who started same month
    "velocity_percentile": 82, # Top 18% in learning speed
    "message": """
You're solving problems faster than 82% of users at your experience level.
However, your success rate on first attempts (42%) is below the cohort average (58%).
This suggests you might benefit from spending more time analyzing problems before coding.
    """
}
```

**7. Time-of-Day & Engagement Patterns**

```python
"engagement_insights": {
    "peak_performance_time": "21:00 - 23:00",  # Best success rate
    "total_hours_coded": 34.5,
    "avg_session_length": "47 minutes",
    "longest_streak": 12,
    "current_streak": 8,
    "idle_days": 3,
    "insight": """
Your success rate is 23% higher in evening sessions. Morning attempts (07:00-09:00)
show rushed solutions with more errors. Consider blocking evening time for deep problem-solving.
    """
}
```

**8. Strategic Recommendations (AI-Generated Learning Path)**

```python
"next_month_roadmap": {
    "primary_focus": "Binary Trees & Recursion",
    "reasoning": """
Your hash map mastery (8.8/10) is solid. Trees are the natural next step because:
1. They reinforce recursion patterns you're already comfortable with
2. Tree problems frequently combine with hash maps (e.g., level-order traversal)
3. 43% of Medium interview questions involve trees
    """,
    "suggested_problems": [
        {
            "week": 1,
            "theme": "Tree Basics",
            "problems": [
                "Invert Binary Tree",
                "Maximum Depth of Binary Tree",
                "Same Tree"
            ]
        },
        {
            "week": 2,
            "theme": "Tree Traversal",
            "problems": [
                "Binary Tree Level Order Traversal",
                "Binary Tree Zigzag Level Order Traversal",
                "Validate Binary Search Tree"
            ]
        },
        {
            "week": 3,
            "theme": "Tree Construction",
            "problems": [
                "Construct Binary Tree from Preorder and Inorder",
                "Serialize and Deserialize Binary Tree"
            ]
        },
        {
            "week": 4,
            "theme": "Advanced Tree Patterns",
            "problems": [
                "Lowest Common Ancestor",
                "Binary Tree Maximum Path Sum",
                "Recover Binary Search Tree"
            ]
        }
    ],
    "secondary_focus": "Maintain hash map skills with 2 problems/week",
    "warning": "Avoid graph problems until trees are solid (graph = tree + cycles)"
}
```

**9. Motivational Element (Gamification)**

```python
"achievements_unlocked": [
    "🔥 Streak Master: 12-day streak",
    "⚡ Speed Demon: Solved 'Two Sum' in under 5 minutes",
    "🎯 Pattern Expert: Mastered Sliding Window technique",
    "🌟 Consistency King: Solved problems 26 days this month"
],
"badges_in_progress": [
    "🌲 Tree Climber: Solve 20 tree problems (3/20)",
    "📊 Graph Navigator: Solve first graph problem (0/1)"
]
```

**10. Historical Comparison (Longitudinal View)**

```python
"month_over_month": {
    "nov_2025": {"problems_solved": 28, "success_rate": 0.61},
    "dec_2025": {"problems_solved": 45, "success_rate": 0.68},
    "improvement": "+61% problems, +11% success rate",
    "narrative": """
December was a breakout month. You solved 61% more problems than November
while increasing your success rate. This isn't just quantity—it's accelerating quality.
    """
}
```

---

**Example Complete Monthly Report Rendering:**

```python
monthly_report = {
    "type": "monthly_deep_dive",
    "period": "December 2025",
    "user_id": "user_123",
    "generated_at": "2026-01-01T00:05:00Z",

    "executive_summary": """
December was a transformative month for your competitive programming journey. You evolved from
a beginner tackling Easy problems to an intermediate solver confidently approaching Medium challenges.

**Key Milestones:**
- 45 problems solved (61% increase from November)
- 68% success rate (up from 61%)
- Mastered 2 new patterns: Sliding Window, Two Pointer
- Achieved 12-day streak (personal best)

You've crossed the inflection point where problem-solving intuition starts to automate.
The way you approached "LRU Cache" on Dec 18—breaking it into sub-problems without hints—shows
emerging systems thinking. That's the Mentat mindset.
    """,

    "skill_radar": {
        "arrays": 8.5,
        "strings": 7.2,
        "hash_maps": 8.8,
        "trees": 3.1,
        "graphs": 1.5,
        "dynamic_programming": 2.3,
        "greedy": 5.4,
        "backtracking": 4.0
    },

    "learning_velocity": {
        "weekly_breakdown": [
            {"week": 1, "problems": 8, "avg_difficulty": 1.2, "success_rate": 0.63},
            {"week": 2, "problems": 12, "avg_difficulty": 1.5, "success_rate": 0.67},
            {"week": 3, "problems": 11, "avg_difficulty": 1.8, "success_rate": 0.72},
            {"week": 4, "problems": 14, "avg_difficulty": 2.1, "success_rate": 0.71}
        ],
        "trend": "accelerating",
        "insight": "Consistent upward trajectory in both volume and difficulty"
    },

    "breakthrough_moments": [
        {
            "date": "2025-12-05",
            "problem": "Two Sum",
            "significance": "First problem solved independently",
            "narrative": "This was your 'hello world' moment in algorithmic thinking."
        },
        {
            "date": "2025-12-18",
            "problem": "LRU Cache",
            "significance": "First Medium problem solved without hints",
            "narrative": "You combined linked lists and hash maps—two concepts you'd learned separately—into a unified solution. That's advanced systems design thinking."
        },
        {
            "date": "2025-12-27",
            "problem": "Word Ladder",
            "significance": "First graph traversal (BFS)",
            "narrative": "You ventured into graph algorithms, showing you're ready to expand beyond linear data structures."
        }
    ],

    "struggle_analysis": [
        {
            "category": "Dynamic Programming",
            "attempts": 8,
            "solved": 1,
            "success_rate": 0.125,
            "common_errors": [
                "Off-by-one errors in DP array initialization",
                "Confusion between top-down vs bottom-up",
                "Difficulty identifying overlapping subproblems"
            ],
            "root_cause": """
DP problems require strong recursion fundamentals. Your backtracking score (4.0/10)
suggests recursive thinking is still developing. You're attempting DP too early in your journey.
            """,
            "recommendation": "Pause DP for 2 weeks. Complete 'Recursion Mastery' track first."
        }
    ],

    "peer_benchmarking": {
        "global_percentile": 67,
        "cohort_percentile": 58,
        "velocity_percentile": 82,
        "insight": """
You're learning faster than 82% of users who started around the same time. However,
your first-attempt success rate (42%) is below cohort average (58%). This suggests
a trade-off: speed vs. accuracy. Consider spending 5 more minutes on problem analysis
before writing code.
        """
    },

    "engagement_patterns": {
        "peak_performance_window": "21:00 - 23:00",
        "total_hours": 34.5,
        "avg_session_length": "47 minutes",
        "longest_streak": 12,
        "current_streak": 8,
        "insight": "Evening sessions have 23% higher success rate. Morning attempts show rushed code."
    },

    "next_month_roadmap": {
        "primary_focus": "Binary Trees & Recursion",
        "reasoning": """
Trees are the natural next step because:
1. They build on hash map patterns you've mastered (8.8/10)
2. They reinforce recursion without DP complexity
3. 43% of Medium interview problems involve trees
4. Your graph attempt (Word Ladder) shows you're ready for hierarchical structures
        """,
        "weekly_plan": [
            {
                "week": 1,
                "theme": "Tree Fundamentals",
                "problems": ["Invert Binary Tree", "Maximum Depth", "Same Tree"],
                "learning_goal": "Understand tree recursion pattern"
            },
            {
                "week": 2,
                "theme": "Tree Traversal",
                "problems": ["Level Order Traversal", "Zigzag Traversal", "Validate BST"],
                "learning_goal": "Master BFS and DFS on trees"
            },
            {
                "week": 3,
                "theme": "Tree Construction",
                "problems": ["Build Tree from Preorder/Inorder", "Serialize/Deserialize"],
                "learning_goal": "Deep understanding of tree structure"
            },
            {
                "week": 4,
                "theme": "Advanced Patterns",
                "problems": ["Lowest Common Ancestor", "Maximum Path Sum"],
                "learning_goal": "Combine multiple tree concepts"
            }
        ],
        "secondary_focus": "Maintain hash map edge with 2 problems/week",
        "avoid": "Graphs (until tree recursion is solid), Advanced DP"
    },

    "achievements": {
        "unlocked_this_month": [
            {"badge": "🔥 Streak Master", "criteria": "12-day streak"},
            {"badge": "⚡ Speed Demon", "criteria": "Solved in under 5 min"},
            {"badge": "🎯 Pattern Expert", "criteria": "Mastered Sliding Window"},
            {"badge": "🌟 Consistency King", "criteria": "26 active days"}
        ],
        "in_progress": [
            {"badge": "🌲 Tree Climber", "progress": "3/20 tree problems"},
            {"badge": "📊 Graph Navigator", "progress": "0/1 graph problems"}
        ]
    },

    "historical_comparison": {
        "november": {"problems": 28, "success_rate": 0.61, "avg_difficulty": 1.1},
        "december": {"problems": 45, "success_rate": 0.68, "avg_difficulty": 1.7},
        "growth": "+61% volume, +11% success rate, +55% difficulty",
        "narrative": "Exponential growth curve. You're not just doing more—you're doing harder, better."
    },

    "closing_message": """
December was proof that the Mentat method works. You didn't just memorize solutions—you
internalized patterns. The way you approached LRU Cache without hints, breaking it into
components, shows emerging mastery.

January's tree focus will unlock the next level. Trees are where algorithmic intuition
crystallizes. By February, graph algorithms will feel natural.

The desert is vast, but you're building the tools to navigate it.

Keep the streak alive. 🏜️
    """
}
```

---

**Technical Implementation:**

**RAG Query for Monthly Report Generation:**

```python
def generate_monthly_report(user_id: str, month: str) -> dict:
    # Step 1: Retrieve all relevant embeddings
    user_history = vector_db.query(
        filter={"user_id": user_id, "month": month},
        include=["submissions", "feedback", "streaks", "timestamps"]
    )

    # Step 2: Aggregate quantitative metrics
    metrics = calculate_monthly_metrics(user_history)

    # Step 3: Identify breakthrough moments (ML-based anomaly detection)
    breakthroughs = detect_inflection_points(user_history)

    # Step 4: Benchmark against peer cohort
    peer_data = vector_db.query(
        filter={"cohort": get_user_cohort(user_id), "month": month},
        anonymize=True
    )
    percentiles = calculate_percentiles(metrics, peer_data)

    # Step 5: Generate strategic recommendations (agentic workflow)
    learning_path = learning_path_agent.recommend(
        user_history=user_history,
        current_skills=metrics["skill_radar"],
        goals=user_preferences.get("goals", "interview_prep")
    )

    # Step 6: Construct narrative using LLM
    prompt = f"""
    You are the Analytics Agent for Mentat Trials. Generate a comprehensive monthly report.

    User Data: {json.dumps(metrics)}
    Breakthroughs: {json.dumps(breakthroughs)}
    Peer Comparison: {json.dumps(percentiles)}
    Recommended Path: {json.dumps(learning_path)}

    Tone: Encouraging, data-backed, mentor-like
    Length: 800-1000 words
    Structure: Executive summary → Analysis → Recommendations → Motivation
    """

    narrative = llm.generate(prompt, temperature=0.7)

    return {
        "narrative": narrative,
        "metrics": metrics,
        "visualizations": generate_charts(metrics),
        "actionable_plan": learning_path
    }
```

**UI Rendering:**

- Beautiful PDF export option
- Interactive charts (hover for details)
- Shareable public link (optional, for portfolio)
- Email digest with key highlights

---

<a id="6-uiux-design"></a>
## 6. UI / UX DESIGN (DUNE-INSPIRED)

### 6.1 Design Philosophy (Silence, Restraint, Intelligence)

Mentat Trials must feel like a tool of thought, not a content feed. The interface should communicate intelligence through calm structure, low-noise layouts, and deliberate typography.

**Principles**
- Silence over noise: reduce clutter; prioritize whitespace and readability.
- Restraint over decoration: minimal surfaces, subtle gradients, purposeful motion.
- Intelligence over affordances: UI anticipates next actions (e.g., Review last mistake pattern).
- State clarity: users always know current problem, run status, verdict, and AI confidence.
- Memory-first: visible traces of learning (notes, patterns, streaks) reinforce long-term mastery.

### 6.2 Visual Language

#### 6.2.1 Color Palette

Palette references desert stone, ink, and spice.
- Obsidian Black (Background): `#0B0F14`
- Basalt (Surface): `#111827`
- Silt (Elevated Surface): `#171F2A`
- Sand (Text Primary): `#E7DCCB`
- Dust (Text Secondary): `#A89F92`
- Spice Amber (Accent / CTA): `#D4A24C`
- Verdict Green (Accepted): `#2FBF71`
- Verdict Red (WA/RE): `#E15554`
- Verdict Yellow (TLE): `#F0B429`
- Focus Blue (Selection): `#6CA6FF`

Accessibility requirements:
- Minimum contrast ratio: 4.5:1 for body text; 3:1 for large text.
- Color is never the only indicator (icons + labels for verdicts).

#### 6.2.2 Typography

- Headings: Fraunces or Cinzel (fallback: Georgia)
- Body: Inter (fallback: system-ui)
- Code: JetBrains Mono (fallback: Consolas)

Rules:
- Reading surfaces (problem statements, AI reports) use line-height 1.6–1.8.
- Analytics numbers use tabular-nums.

### 6.3 Component Design (Implementation-Oriented)

#### 6.3.1 Problem Library (Dashboard)

Layout:
- Left rail: filters (Difficulty, Category, Status, Pattern tags)
- Main: problem list (table/grid)
- Right rail: Mentat Suggestion panel for returning users (hidden on first session)

Each problem row/card must show:
- Title
- Difficulty tag (Easy/Medium/Hard)
- Category (Arrays, Strings, Math, DP, etc.)
- User status: Not Started / Attempted / Solved
- Last attempt timestamp
- Recommended flag (Learning Path Agent output)

#### 6.3.2 Problem Detail Page

Split view:
- Left: statement tabs (Description, Constraints, Examples, Discussion)
- Right: workspace (Editor, Input/Output, Results, Mentat Whisper)

Controls:
- Run (custom stdin)
- Submit (hidden tests)
- Get AI Feedback (baseline)
- Compare with past mistakes (only when history exists)

#### 6.3.3 Code Editor

MVP editor options: Monaco (preferred), `react-simple-code-editor`, or `<textarea>`.

Requirements:
- At least one language (recommended MVP: Python 3.11)
- Syntax highlighting
- Draft autosave per problem
- Shortcuts: Run (`Ctrl+Enter`), Submit (`Ctrl+Shift+Enter`)

#### 6.3.4 AI Feedback Panel (Mentat Whisper)

Primary AI surface. Must be structured, scannable, and grounded.

Default structure:
- What happened (verdict + failing tests summary)
- Why it happened (root cause)
- One next step (single actionable improvement)
- Pattern label (e.g., Sliding Window)
- Memory note (what will be remembered)

Controls:
- Helpful / Not helpful (with reason)
- Ask follow-up (rate-limited)
- Save as note (explicit user memory)

#### 6.3.5 Analytics Dashboards

Views:
- Overview: streak, heatmap, recent submissions
- Skills: radar chart, pattern mastery, difficulty progression
- Reports: weekly/monthly archive

### 6.4 3D Landing Page Concept

Goal: set tone (memory + intelligence) with minimal GPU/CPU overhead.

#### 6.4.1 Hero Animation
- Desert plane with subtle dune ripples (procedural noise)
- Floating glyphs representing patterns
- Spice particle stream converging into a Mentat lens

#### 6.4.2 Motion & Scroll
- Calm camera drift (no aggressive motion)
- Scroll timeline:
  - 0–25%: lens forms
  - 25–60%: memory layers reveal
  - 60–100%: transition to product screenshots

#### 6.4.3 Technology Choices
- Three.js + React Three Fiber (R3F)
- GSAP + ScrollTrigger
- Progressive enhancement:
  - disable 3D for `prefers-reduced-motion`
  - adaptive DPR and quality levels

---

<a id="7-social-features"></a>
## 7. SOCIAL FEATURES (DETAILED)

Social features are designed as collective memory: high-signal discussion, hints, and moderation that preserve learning quality.

### 7.1 Problem Discussion Threads

Thread types:
- Question
- Hint
- Explanation
- Edge Case
- Optimization

Capabilities:
- Markdown + code blocks with syntax highlighting
- Upvote/downvote (trust-weighted)
- Mark as Helpful (OP + moderators)
- Sort: Top (trust-weighted), New, Mentat-curated

Anti-spoiler defaults:
- Posts classified as solution-level are collapsed behind a spoiler warning.
- Community reporting + trust penalties for repeated violations.

### 7.2 Hint Systems

Hint types:
- Community hints (short nudges)
- Mentat hints (AI-generated and personalized)

Hint unlock progression:
- Hint 1: pattern-level
- Hint 2: approach-level
- Hint 3: complexity-level
- Hint 4+: gated behind Im stuck confirmation; never reveals full solution in baseline learning mode

### 7.3 AI-Moderated Comments

Moderation pipeline:
1. Pre-publish checks: toxicity, spam, solution leakage, prompt injection indicators
2. Actions: allow, allow+blur (soft warning), hold for review, block
3. Explainability: show reason + how to revise when blocked/blurred

### 7.4 Reputation & Trust Signals

Signals:
- Helpful marks received
- Low moderation incident rate
- Downstream effectiveness of hints (users solve after reading)
- Verified connections (GitHub link; org/university email domain) (optional)

Trust levels:
- Level 0: new (rate-limited)
- Level 1: normal
- Level 2: trusted (can tag posts, suggest metadata)
- Level 3: curator (assist moderation; propose canonical hints)

### 7.5 Community Engagement Design

- Pattern-of-the-week threads
- Opt-in Explain one solution per week prompts
- Monthly Mentat Chronicle (best hints + anonymized learning insights)

---

<a id="8-non-functional-requirements"></a>
## 8. NON-FUNCTIONAL REQUIREMENTS

### 8.1 Performance

**Frontend SLOs**
- Initial load (cold): p75 < 3.0s on broadband; p75 < 5.0s on mid-tier mobile.
- Editor interactive after navigation: < 1.5s.
- Avoid long-lived large in-memory contexts; cap cached AI payloads on client.

**Backend SLOs**
- Auth endpoints: p95 < 200ms.
- Problem list/details: p95 < 300ms.
- Submission creation: p95 < 500ms (excluding execution).
- Retrieval + prompt assembly: p95 < 800ms (excluding LLM).

**Executor Targets (Best-Effort)**
- Run mode median < 2.5s for small inputs.
- Queue time p95 < 5s under normal load.

### 8.2 Security

- OWASP-aligned secure coding and review.
- RBAC enforced at API gateway and service layer.
- Secure code execution sandbox:
  - no access to internal network
  - strict CPU/memory/time limits
  - per-run container isolation
  - syscalls restricted (seccomp/AppArmor)
- Anti-automation and abuse controls:
  - rate limiting per user/IP
  - bot detection on signup and comment posting
- Audit logs:
  - admin edits to problems/tests
  - role changes
  - abnormal access patterns

### 8.3 Privacy

- Explicit notice: submissions and feedback are stored to build learning memory.
- Encrypt sensitive data at rest (KMS) and in transit (TLS).
- Least-privilege access to user code/feedback.
- Data retention policy:
  - keep submissions + feedback by default (user-controlled deletion)
  - executor logs: short-lived retention (e.g., 7–30 days)
- Export/delete:
  - export includes submissions, feedback, reports, profile
  - delete supports hard-delete or anonymization based on policy

### 8.4 Scalability

- Stateless API services horizontally scalable.
- Isolate heavy execution workloads from core API plane.
- Vector retrieval bounded by:
  - strict top-k
  - metadata filters (user_id, problem_id, timeframe)
  - max context tokens
- Background jobs/queues for embeddings, report generation, external sync.

### 8.5 Reliability

- Graceful degradation:
  - if AI is down: judge features still usable
  - if executor is down: browsing, drafts, and history still usable
- Observability:
  - distributed tracing across API  AI service  vector store
  - structured logs with request IDs
  - metrics for cost, latency, error rate
- SLOs with error budgets; paging policies for critical failures.

### 8.6 AI Explainability

- Every AI output must include:
  - evidence categories used (e.g., your last 3 submissions, problem constraints, common pitfalls) without exposing hidden tests
  - confidence bucket (High/Medium/Low)
- Safety policies:
  - do not reveal full solutions in baseline mode
  - do not reveal hidden tests or their expected outputs

---

<a id="9-tech-stack"></a>
## 9. TECH STACK (JUSTIFIED)

### 9.1 Frontend

- Next.js (React) + TypeScript: stable routing, SSR/edge options, strong ecosystem.
- Monaco Editor: best-in-class code editor, extensible.
- Styling: Tailwind CSS (or equivalent design system) for consistent theming.
- Charts: Recharts (MVP), D3.js (advanced).
- Heatmap: `react-calendar-heatmap` (baseline).

### 9.2 Backend

Recommended service split for enterprise-grade scale:
- Core API (NestJS, TypeScript): auth/RBAC, problems, submissions, social, analytics.
- AI Orchestrator (FastAPI, Python): LangChain/LangGraph workflows, retrieval, evaluation.

### 9.3 Data Layer

- PostgreSQL: canonical source of truth for users/problems/submissions.
- Redis: rate limiting, queues, caching.
- Object storage (S3/Azure Blob): optional for exports, large artifacts.

### 9.4 AI Stack

- LLM provider abstraction: OpenAI / Gemini (configurable).
- Orchestration: LangGraph for agentic workflows; LangChain components for retrieval/tools.
- Safety:
  - policy validators
  - prompt regression tests
  - content classifiers for solution leakage

### 9.5 Vector DB

- MVP: Postgres + `pgvector` (minimal ops).
- Scale: Pinecone / Weaviate / Qdrant depending on throughput and latency needs.

### 9.6 Code Execution

- Judge0 (recommended) for multi-language sandbox and predictable APIs.
- Piston acceptable for lightweight MVP deployments.
- Prefer self-hosted for cost control and reduced vendor dependency.

### 9.7 Deployment

- Docker for all services.
- Kubernetes (AKS/EKS/GKE) for scaling and isolation.
- CI/CD: GitHub Actions.
- IaC: Terraform.
- Secrets: cloud KMS + sealed secrets.

---

<a id="10-data-models"></a>
## 10. DATA MODELS (HIGH-LEVEL)

These data models are intentionally designed so baseline judge features produce structured artifacts that are directly consumable by the RAG and agent layers.

### 10.1 Users

Core fields:
- `id` (UUID)
- `email` (unique)
- `password_hash`
- `role` (USER | ADMIN)
- `display_name`
- `created_at`, `last_login_at`

Optional fields (enterprise-ready):
- `preferences` (JSON: goals, language, time budget, difficulty tolerance)
- `privacy_settings` (JSON)

### 10.2 Problems

- `id`, `slug` (unique)
- `title`
- `difficulty` (Easy/Medium/Hard)
- `category` (Arrays/Strings/Math/DP/etc.)
- `tags` (array)
- `statement_markdown`
- `input_format_markdown`, `output_format_markdown`, `constraints_markdown`
- `samples` (JSON array)
- `status` (Draft/Published)
- `created_by` (admin user id)
- `created_at`, `updated_at`, `published_at`

### 10.3 Test Cases

- `id`, `problem_id`
- `visibility` (VISIBLE | HIDDEN)
- `input`, `expected_output`
- `time_limit_ms`, `memory_limit_kb`
- `created_at`

### 10.4 Submissions

- `id`, `user_id`, `problem_id`
- `language`
- `source_code` (immutable)
- `verdict` (Accepted/Wrong Answer/Runtime Error/Time Limit Exceeded)
- `runtime_ms`, `memory_kb` (best-effort)
- `created_at`
- `evaluation_summary` (JSON: failing tests count, error messages, normalized diff snippet without revealing hidden cases)

### 10.5 AI Feedback Memory

Baseline + advanced feedback are stored using a unified schema.

- `id`, `user_id`, `problem_id`, `submission_id` (nullable)
- `type` (immediate | comparative | weekly | monthly | note)
- `content_markdown`
- `metadata` (JSON: confidence, detected pattern tags, cited artifacts)
- `created_at`

### 10.6 Analytics Events

- `id`, `user_id`
- `event_name` (view_problem/run_code/submit/request_ai_feedback/open_hint/etc.)
- `properties` (JSON)
- `created_at`

### 10.7 Comments (Community Layer)

- `id`, `problem_id`, `user_id`
- `body_markdown`
- `moderation_state` (allowed/blurred/held/blocked)
- `created_at`, `updated_at`
- `score` (trust-weighted)

---

<a id="11-metrics--kpis"></a>
## 11. METRICS & KPIs

### 11.1 Engagement

- DAU/WAU/MAU
- Problems attempted per active user per week
- Submissions per active user
- Heatmap density (active days/month)
- Streak distribution (median, p90)
- Session duration in editor

### 11.2 Learning Effectiveness

- Attempts-to-Accepted by difficulty
- Time-to-first-Accepted per category
- Error-class trends (WA vs RE vs TLE) over time
- Pattern mastery progression (internal rubric, e.g., Sliding Window: learning  proficient  mastered)
- Transfer learning metric: performance on new problems sharing a learned pattern

### 11.3 AI Usefulness

- % submissions followed by AI feedback request
- Helpfulness ratings (thumbs up/down)
- Actionability: % of feedback that results in improved verdict within next N attempts
- Over-helping guardrail: % of outputs flagged as solution-revealing (target near-zero)

### 11.4 Retention

- D1/D7/D30 retention
- Weekly/monthly report open rate
- Return-after-failure rate (user returns within 24h after WA/TLE)

### 11.5 System & Cost

- p95 latency for core endpoints and retrieval
- Executor queue depth and failure rate
- Cost per active user per month (LLM + embeddings + vector)

---

<a id="12-risks--mitigations"></a>
## 12. RISKS & MITIGATIONS

### 12.1 AI Hallucinations / Incorrect Guidance

Risks:
- AI gives wrong debugging advice.
- AI implies a full solution (solution leakage).

Mitigations:
- Constrained prompts and explicit no full solution rules.
- Output validation + solution-leak classifier.
- Evidence-first responses (tie feedback to users code and execution results).
- Confidence labeling; ask clarifying questions when low confidence.

### 12.2 Privacy & Data Governance

Risks:
- Storing code and feedback creates sensitivity.

Mitigations:
- Clear consent and controls (export/delete).
- Encryption at rest and strict access controls.
- Short retention for executor logs.

### 12.3 Cost Control

Risks:
- LLM calls dominate unit economics.

Mitigations:
- Tiered models (cheap classifier + stronger generator).
- Caching of retrieval contexts.
- Rate limits and quotas.
- Batch embedding jobs and deduplication.

### 12.4 Abuse Prevention (Spam, Toxicity, Prompt Injection)

Risks:
- Community spam and toxicity.
- Prompt injection through comments/problem statements.

Mitigations:
- AI moderation pipeline + community reporting.
- Sanitization of markdown and code blocks.
- Tool isolation: LLM never executes user-provided instructions as system policy.

### 12.5 Code Execution Sandbox Escape

Risks:
- Container breakout or internal network access.

Mitigations:
- Hardened executor (Judge0) with strict isolation and network egress blocked.
- Resource limits and syscall restrictions.
- Separate network plane for executor.

---

<a id="13-15-day-delivery-plan"></a>
## 13. 15-DAY DELIVERY PLAN

This plan is intentionally sequenced to build the AI and data foundations early (so we do not retrofit memory later), while still delivering the non-negotiable online-judge baseline. UI is last.

### Day 1 — Architecture & Contracts
- Finalize system boundaries: Core API, Executor service, AI Orchestrator.
- Define API contracts (OpenAPI) for: auth, problems, run, submit, feedback, analytics.
- Repo setup: CI, linting, Docker Compose, environments.

### Day 2 — Data Model + Auth/RBAC
- Postgres schema migrations for Users, Problems, TestCases, Submissions, Feedback, Events.
- Email/password auth with secure session strategy (JWT or server sessions).
- RBAC middleware and admin scaffolding.

### Day 3 — Problem Admin + Publishing
- Admin CRUD for problems and test cases (visible + hidden).
- Validation rules (required statement fields, at least one hidden test).
- Seed initial 10 problems (2 per major category).

### Day 4 — Executor Integration (Run Mode)
- Integrate Judge0/Piston: run endpoint for custom stdin.
- Capture stdout/stderr, runtime/memory where available.
- Rate limits and per-user quotas.

### Day 5 — Submission Evaluation (Hidden Tests)
- Submit endpoint executes hidden tests.
- Output normalization policy (documented and deterministic).
- Verdict mapping: AC/WA/RE/TLE.
- Store immutable submissions.

### Day 6 — Submission History + Activity Aggregations
- Submission history APIs (filter by problem, verdict, date range).
- Daily activity aggregation table/materialized view for heatmap.
- Streak computation endpoint (current + best).

### Day 7 — Baseline AI Feedback (MVP AI)
- Get AI Feedback endpoint:
  - input: code + problem context + execution summary
  - output: constrained explanation (no full solution)
- Store feedback linked to submission.
- Add basic safety filters (solution leakage + hidden test leakage).

### Day 8 — Vector Memory Foundations
- Define chunking strategy for submissions and feedback.
- Add `pgvector` embeddings table.
- Build ingestion job (async) for new submissions/feedback.

### Day 9 — Retrieval + Context Builder
- Retrieval API: top-k with strict metadata filters (user_id, problem_id, timeframe).
- Context construction rules (token budgets, dedupe, recency bias).
- Prompt assembly templates versioned in code.

### Day 10 — Agent Orchestration (Thin Vertical Slice)
- LangGraph workflow skeleton.
- Implement Feedback Agent + Learning Path Agent collaboration.
- Trace logs per AI run (inputs, retrieved sources, output policy verdict).

### Day 11 — Social Baseline + Moderation MVP
- Comments CRUD under problem page; markdown rendering + sanitization.
- AI moderation: allow/blur/hold/block.
- Basic reputation signals (helpful marks).

### Day 12 — Analytics (Baseline + AI Reports MVP)
- Category solved percentages.
- Weekly report generation (stored artifact).
- Report archive endpoint.

### Day 13 — External Connection MVP (GitHub)
- OAuth connect flow and secure token storage.
- Minimal sync job (last synced timestamp, basic activity metrics).
- Combined analytics endpoint.

### Day 14 — Frontend MVP (Core Flows)
- Auth screens.
- Problem library + detail page.
- Editor + Run/Submit + results.
- Get AI Feedback button + Mentat Whisper panel.

### Day 15 — Hardening + Release Candidate
- Load test executor queue and rate limits.
- Security pass (RBAC, input validation, XSS, CSRF where applicable).
- Observability dashboards (latency, error rate, AI cost).
- Production deployment runbook.

---

<a id="14-future-roadmap"></a>
## 14. FUTURE ROADMAP

### 14.1 Contest Mode
- Scheduled contests, live leaderboards.
- Contest-safe AI: post-contest analysis only; in-contest AI limited to non-solution guidance.

### 14.2 Team Battles
- Team-based competition and collaborative retrospectives.
- AI-generated team reports (strengths, gaps, recommended drills).

### 14.3 Advanced AI Mentoring
- Socratic multi-turn tutoring with strict no full solution policies.
- Personalized Skill Graph with prerequisite dependencies.
- Difficulty tuning via bandit-style exploration/exploitation per user.

### 14.4 Enterprise / University Adoption
- Multi-tenant org workspaces.
- Instructor dashboards and assignment mode.
- SSO (SAML/OIDC), SCIM provisioning.
- Compliance and audit features.

---

<a id="15-baseline-functional-requirements-mvp"></a>
## 15. BASELINE FUNCTIONAL REQUIREMENTS (MVP – NON-NEGOTIABLE)

This section defines the minimum functional scope required for Mentat Trials to be complete and usable as an online judge. All advanced AI features must be built on top of these foundations.

### 15.1 User & Role Management

**Requirements**
- Email/password signup and login.
- Roles: User and Admin.
- Secure session handling and RBAC.

**Implementation Notes**
- Passwords: bcrypt/argon2.
- Sessions: JWT with rotation or server sessions with secure cookies.
- Admin-only routes must validate role at the server.

**Acceptance Criteria**
- A normal user cannot create/edit problems.
- Sessions expire and are invalidated on logout.

### 15.2 Problem Library

**Requirements**
- Central dashboard listing all problems.
- Each problem displays: title, difficulty, category.
- Filter and sort by difficulty and category.

**Acceptance Criteria**
- Filtering does not require page reload (client state + query params).
- Results are consistent with backend filtering.

### 15.3 Problem Detail Page

**Requirements**
- Dedicated page per problem with:
  - description
  - input/output format
  - constraints
  - sample input/output
- Clear separation between visible examples and hidden test cases.

**Acceptance Criteria**
- Hidden test cases are never returned by public APIs.
- Samples are rendered exactly as specified by problem author.

### 15.4 Integrated Coding Workspace

**Requirements**
- Browser-based code editor (Monaco, react-simple-code-editor, or textarea).
- Support at least one language initially.
- Include:
  - optional language selector
  - Run button for custom input execution

**Acceptance Criteria**
- Draft code persists per user per problem.
- Run executes using user-provided stdin.

### 15.5 Code Execution (Run Mode)

**Requirements**
- Run sends source code + stdin to execution API (Judge0/Piston).
- Display stdout and stderr.
- Execution is sandboxed.

**Acceptance Criteria**
- Users cannot access server filesystem or network from code.
- Run requests are rate-limited.

### 15.6 Submission System

**Requirements**
- Submit runs against hidden test cases.
- Compare output against expected output.
- Return verdict:
  - Accepted
  - Wrong Answer
  - Runtime Error
  - Time Limit Exceeded
- Submissions are immutable.

**Acceptance Criteria**
- Verdict is returned with summary (e.g., failing count) without revealing hidden inputs/outputs.
- Submissions cannot be edited after creation.

### 15.7 Submission History Storage

**Requirements**
- Store submission history per user:
  - timestamp
  - problem name
  - verdict
- Display on dashboard.

**Acceptance Criteria**
- Users can filter by verdict and date range.
- Users can only view their own submissions.

### 15.8 AI Tutor Feedback (Baseline AI Requirement)

**Requirements**
- After each submission, show Get AI Feedback.
- Clicking sends: user code, problem context, execution result.
- Prompt constraint:
  - explain why code failed
  - suggest one optimization
  - do not reveal full solution
- Feedback is stored for future retrieval.

**Acceptance Criteria**
- Feedback is linked to the submission.
- Outputs are blocked/rewritten if they reveal full solutions or hidden test cases.

### 15.9 Visual Activity Heatmap

**Requirements**
- GitHub-style activity heatmap per user.
- Each day with at least one submission is represented.
- Use `react-calendar-heatmap`.

**Acceptance Criteria**
- Heatmap covers at least last 365 days.
- Clicking a day shows submissions for that day.

### 15.10 Dynamic Streak Counter

**Requirements**
- Track consecutive days with at least one Accepted submission.
- Display current streak and best streak.

**Acceptance Criteria**
- Streak logic handles timezones consistently (store and compute in UTC; render in user TZ).

### 15.11 Basic Performance Analytics

**Requirements**
- Analytics view showing % solved by category.
- Pie or bar charts.

**Acceptance Criteria**
- Category percentages match submissions with Accepted verdict.

### 15.12 Social Features (Baseline Community Layer)

**Requirements**
- Comment section below each problem:
  - hints and discussions
  - markdown support
- User dashboard:
  - connect external platforms (GitHub)
  - view combined analytics

**Acceptance Criteria**
- Comments are sanitized (XSS-safe) and rate-limited.
- External platform tokens are encrypted.

### 15.13 Integration with Advanced AI Layer

**Requirements**
- Baseline features must feed structured data into RAG:
  - submissions, verdicts, timing, categories, feedback interactions
- Persist user behavior for long-term memory.
- Baseline AI feedback evolves into agentic workflow without refactoring core systems.

**Acceptance Criteria**
- Every submission and feedback artifact is chunked and embeddable.
- Retrieval can filter by user, problem, category, and time window.
- Agent workflows can call baseline APIs via stable contracts.

---
