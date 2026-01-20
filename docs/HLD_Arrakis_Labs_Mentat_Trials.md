# High Level Design (HLD)

## 1. Title Page

**Project Title:** Arrakis Labs (Mentat Trials): AI‑Powered Competitive Programming & Learning Platform  
**Project Type:** Web Application (Full‑Stack Platform with AI Microservice)  
**Team Members:**  
- Student 1 (Name, Roll No.)  
- Student 2 (Name, Roll No.)  
- Student 3 (Name, Roll No.)  
- Student 4 (Name, Roll No.)  
**Project Guide:** Guide Name (Designation)  
**Institution:** Institution Name, Department Name  
**Academic Year:** 2025–2026

---

## 2. Introduction

### 2.1 Background
Competitive programming and interview‑oriented problem solving have become central to computer science education and software recruitment. Online judge platforms have enabled large‑scale access to curated problem libraries and automated evaluation. However, the learning value of these platforms often remains limited because users receive primarily verdict‑oriented feedback (e.g., Accepted/Wrong Answer/Time Limit Exceeded), with minimal insight into conceptual gaps or recurring mistakes.

In parallel, contemporary AI systems can provide contextual explanations and learning guidance. When integrated responsibly, AI can augment an online judge by transforming submission outcomes into structured mentorship, thereby supporting individualized learning trajectories rather than only measuring correctness.

### 2.2 Motivation
The motivation for Arrakis Labs (Mentat Trials) is to bridge the pedagogical gap between automated judging and meaningful learning support. Students and early‑career developers frequently struggle to diagnose failures, identify missing conceptual prerequisites, and plan a structured progression across topics. The project aims to provide:

- Timely, context‑aware feedback that helps users understand the nature of mistakes.
- Persistent learning memory that improves guidance quality over time.
- Real‑time contest capabilities to preserve the competitive aspect of programming.
- Administrative tools for curated content management and assessment integrity.

### 2.3 Purpose of the System
The purpose of the system is to deliver an integrated learning and competition platform where users can:

- Solve programming problems in a browser‑based coding environment.
- Execute and submit solutions for automated evaluation.
- Participate in scheduled contests with live leaderboards.
- Receive AI‑assisted feedback and learning recommendations based on historical performance.

---

## 3. Problem Statement

### 3.1 Real‑World Problem
Existing coding practice platforms often provide evaluation without mentorship. When a submission fails, learners encounter uncertainty regarding:

- Whether the failure arises from conceptual misunderstanding, edge cases, constraints handling, or input/output formatting.
- Which prerequisite concepts to revise.
- Which next problems should be attempted to improve systematically.

This results in inefficient learning cycles, loss of motivation, and suboptimal preparation for competitive programming or interviews.

### 3.2 Limitations of Existing Systems
Common limitations observed in traditional systems include:

- **Binary feedback:** Verdict‑centric outputs without actionable learning guidance.
- **No personalization:** Minimal adaptation to individual learning history.
- **Weak progression support:** Lack of structured, user‑specific learning paths.
- **Contest separation:** Competitive features and learning features are often siloed.
- **Administrative overhead:** Content management and test case curation may be cumbersome.

Arrakis Labs addresses these limitations through a unified architecture that integrates standard judging with AI‑enabled mentorship and real‑time competition.

---

## 4. Objectives of the System

### 4.1 Functional Objectives
- Provide user registration and secure authentication.
- Enable browsing and viewing of a problem library with difficulty and metadata.
- Provide an in‑browser coding environment supporting multiple languages.
- Support “Run” (sample/visible test cases) and “Submit” (full evaluation, including hidden tests).
- Persist submissions, verdicts, and learning history for each user.
- Provide AI‑assisted feedback and recommendations based on current submission context and user history.
- Support contest creation, scheduling, participation tracking, and live leaderboard updates.
- Provide an administrative dashboard for question management, test case management, and bulk imports.

### 4.2 Non‑Functional Objectives
- **Performance:** Low‑latency user experience for common operations (problem browsing, submission outcomes, leaderboard refresh).
- **Scalability:** Ability to support increased numbers of users, submissions, and concurrent contest participants.
- **Security:** Strong authentication, role‑based access, safe handling of untrusted submissions via external sandboxed execution, and protection against common web threats.
- **Reliability:** Predictable contest lifecycle transitions and stable real‑time updates.
- **Usability:** Clear UX for learners, readable feedback, and minimal friction in executing and submitting code.
- **Maintainability:** Modular separation of concerns across frontend, backend, and AI service.

---

## 5. System Overview

### 5.1 High‑Level System Description
Arrakis Labs is a full‑stack web platform comprising:

- A **Frontend Web Application** for user interaction, problem solving, and admin operations.
- A **Backend Server** that exposes REST APIs for platform functionality and hosts real‑time WebSocket communication for contests.
- An **AI Service** that produces structured feedback using a multi‑agent workflow and memory retrieval.
- Persistent **data stores** for operational data (users, problems, submissions) and vectorized memory (AI learning traces).
- An external **sandboxed code execution service** to evaluate untrusted code safely.

### 5.2 User Interaction Overview
The system supports two primary user categories:

- **Learners/Participants (Users):** register/login, browse problems, write code, run/submit solutions, view results and feedback, and participate in contests.
- **Administrators:** manage problems and test cases, curate contests, monitor submissions, and perform content operations such as bulk uploads.

### 5.3 Overall Workflow Summary
At a high level, the system operates as follows:

1. A user selects a problem and writes a solution in the browser.
2. The user runs the solution against visible test cases for quick validation.
3. The user submits the solution for full evaluation (including hidden test cases).
4. The backend records results and, where appropriate, requests AI feedback.
5. The AI service uses historical memory and structured workflows to generate feedback and recommendations.
6. If the user is in a contest, the backend updates the leaderboard and broadcasts updates via WebSockets.

---

## 6. System Architecture

### 6.1 Chosen Architecture Style
The system adopts a **modular full‑stack architecture with service separation**, combining:

- **Client–Server architecture** for user interaction and API‑driven operations.
- **Layered separation** within the backend (API layer, service layer, persistence layer).
- **Microservice‑oriented separation** for the AI subsystem to isolate AI computation and memory from core judge operations.
- **Event‑style real‑time communication** using WebSockets for contest leaderboards.
- **Externalized execution** via a sandbox service to mitigate risks of running untrusted code.

This architecture supports maintainability and security while enabling independent evolution of the AI service and core platform.

### 6.2 High‑Level Architecture ASCII Block Diagram

```
[End Users / Admins]
        |
        v
[Frontend Web Application]
(Problem UI, Editor, Admin Panel)
        |
        |  REST APIs (HTTPS)
        v
[Backend Server]
(Authentication, Problems, Submissions,
Contests, WebSocket Gateway)
   |              |                 |
   |              |                 |
   |              |                 +------------------+
   |              |                                    |
   |              v                                    v
   |        [AI Service]                         [WebSocket Clients]
   |   (Feedback & Recommendations)              (Live Leaderboards)
   |
   +------------------+
   |                  |
   v                  v
[Operational DB]   [Cache / Leaderboard Store]
(MongoDB)          (Redis)
   |
   v
[Vector Memory Store]
(Chroma Vector DB)

[External Sandboxed Executor]
(Piston API)
  ^
  |
  +---- Backend requests code execution and receives results
```

### 6.3 Architectural Components (High‑Level Explanation)

- **Frontend Web Application:** Presents the user interface for problem browsing, code editing, submission workflows, contest participation, and administrator dashboards. It acts as the primary interaction layer and communicates with the backend through REST and WebSocket protocols.

- **Backend Server:** Serves as the central orchestration layer. It validates requests, enforces authentication and authorization, coordinates judging through external execution, persists user activity, triggers contest events, and aggregates data for dashboards.

- **AI Service (Mentorship Microservice):** Provides AI‑assisted feedback and learning recommendations. It is logically separated from the backend to reduce coupling and to allow independent scaling. It uses a memory store to retrieve user‑specific historical context.

- **Operational Database (MongoDB):** Stores platform data such as users, questions, contests, submissions, and administrative records. It supports transactional correctness at the application level and maintains the authoritative state of platform entities.

- **Cache / Leaderboard Store (Redis):** Supports fast retrieval and update of contest leaderboard data and other latency‑sensitive aggregates. It reduces database load during high‑concurrency contest scenarios.

- **Vector Memory Store (Chroma DB):** Stores vector representations of user interactions and learning traces, enabling retrieval‑augmented generation of personalized feedback.

- **External Sandboxed Executor (Piston API):** Executes user code in isolated environments. This design choice isolates the platform infrastructure from untrusted code, improving security and simplifying sandbox management.

---

## 7. Module Description

This section presents a top‑down module view of the system. Each module is defined by its responsibilities and interactions, without referencing code‑level implementation.

### 7.1 User & Identity Management Module
**Responsibilities:**
- User registration and login.
- Secure session handling.
- Profile retrieval and basic user metadata.

**Interactions:**
- Consumed by all protected platform features.
- Supplies identity context to submission storage, AI feedback association, and contest participation tracking.

### 7.2 Problem Library & Content Delivery Module
**Responsibilities:**
- Cataloging problems by difficulty, tags, and metadata.
- Delivering problem statements, constraints, and examples to users.

**Interactions:**
- Provides inputs to the code editor module.
- Used by contest module to assemble problem sets.

### 7.3 Code Workspace & Submission Module
**Responsibilities:**
- Accepting user code, selected language, and submission intent (Run vs Submit).
- Coordinating evaluation requests with the judge/execution module.
- Recording outcomes and presenting structured results.

**Interactions:**
- Reads problem specifications and test configuration.
- Writes submission records to the operational database.
- Triggers AI feedback generation when required.

### 7.4 Judge & Execution Orchestration Module
**Responsibilities:**
- Submitting untrusted code to the external sandboxed execution service.
- Collecting execution outputs and verdicts.
- Enforcing evaluation rules such as visible vs hidden test exposure.

**Interactions:**
- Invoked by the submission module.
- Supplies evaluation signals to contest scoring and AI feedback.

### 7.5 Contest Management & Scheduling Module
**Responsibilities:**
- Creating and configuring contests (timing, problem sets, rules).
- Managing contest lifecycle states (scheduled, live, ended).
- Aggregating contest participation data.

**Interactions:**
- Uses submission outcomes for scoring.
- Publishes state transitions and scoring updates to the leaderboard module.

### 7.6 Real‑Time Leaderboard Module
**Responsibilities:**
- Maintaining contest leaderboard state for active contests.
- Broadcasting leaderboard updates to connected clients.

**Interactions:**
- Consumes contest scoring events from backend logic.
- Uses fast storage for real‑time performance.
- Publishes updates to frontend through WebSockets.

### 7.7 AI Feedback & Learning Guidance Module (AI Service)
**Responsibilities:**
- Generating structured feedback on failed or suboptimal submissions.
- Producing learning recommendations (concepts to revise, suggested next practice areas).
- Maintaining a persistent memory of user learning patterns.

**Interactions:**
- Receives submission context and historical references from backend.
- Reads from and writes to the vector memory store.
- Returns feedback payloads to backend for presentation.

### 7.8 Admin & Governance Module
**Responsibilities:**
- Problem and test case lifecycle management.
- Bulk upload and curation support.
- Administrative dashboards for monitoring platform metrics.

**Interactions:**
- Requires elevated role permissions.
- Writes to operational database and affects content delivered to users.

---

## 8. Data Flow Description

### 8.1 Data Movement Across the System (Narrative)
The primary data flows can be summarized as:

- **Authentication flow:** Credentials are validated by the backend; successful authentication establishes a secure session used for subsequent requests.
- **Problem consumption flow:** The frontend requests a list of problems and problem details; the backend retrieves and returns the required content.
- **Execution flow (Run):** The frontend submits code for sample execution; the backend requests evaluation using visible test cases and returns results intended for user debugging.
- **Evaluation flow (Submit):** The frontend submits code for full evaluation; the backend evaluates using both visible and hidden tests, stores results, and returns verdict summaries.
- **AI feedback flow:** For submissions requiring guidance, the backend forwards submission context to the AI service, which retrieves historical memory and returns personalized feedback.
- **Contest flow:** During contests, submission outcomes update contest scoring; the leaderboard store is updated and real‑time events are pushed to clients.

### 8.2 DFD Level 0 (Context Diagram) — ASCII

```
                    +----------------------+
                    |   External Executor  |
                    |     (Piston API)     |
                    +----------^-----------+
                               |
                               |
+------------------+           |           +----------------------+
|  End Users       |           |           |   Administrators     |
| (Learners/Contest|           |           | (Content Managers)   |
|  Participants)   |           |           +----------+-----------+
+--------+---------+           |                      |
         |                     |                      |
         |  Web UI (REST/WS)   |                      |  Web UI (REST)
         v                     |                      v
   +-----+-----------------------------------------------+-----+
   |               Arrakis Labs Platform (System)               |
   | (Frontend + Backend + AI Service + Datastores Integration) |
   +-----+-----------------------------------------------+-----+
         |                     |                      |
         |                     |                      |
         v                     v                      v
+------------------+   +------------------+   +----------------------+
| Operational DB   |   | Vector Memory DB |   | Cache/Leaderboard DB  |
| (MongoDB)        |   | (Chroma)         |   | (Redis)               |
+------------------+   +------------------+   +----------------------+
```

### 8.3 DFD Level 1 — ASCII (Major Processes)

```
[User/Admin]
    |
    v
(1) Authentication & Session Management
    |------------------------------+
    |                              |
    v                              v
[Operational DB]              (2) Role & Access Control
                                     |
                                     v
                              +--------------+
                              | Authorized?  |
                              +------+-------+
                                     |
                                     v
(3) Problem & Contest Content Delivery
    |----------------------+
    |                      |
    v                      v
[Operational DB]        (4) Contest Lifecycle & Scoring
                             |             |
                             v             v
                       [Redis Leaderboard] (5) WebSocket Broadcast
                                             |
                                             v
                                     [Live Leaderboard UI]

(6) Code Run / Submit Request
    |
    +------------------------------+
    |                              |
    v                              v
(7) Execution Orchestration   (8) Submission Persistence
    |                              |
    v                              v
[External Executor]            [Operational DB]
    |
    v
(9) Result Aggregation & Feedback Trigger
    |
    +------------------------------+
    |                              |
    v                              v
(10) AI Feedback Request       (11) Direct Result Response
     |                               |
     v                               v
 [AI Service]                  [Frontend UI]
     |
     v
 [Vector Memory DB]
     |
     v
(12) Personalized Feedback Response
     |
     v
[Frontend UI]
```

---

## 9. Technology Stack

### 9.1 Frontend Technologies
- Single‑Page Application (SPA) paradigm
- React (UI component model)
- Vite (build and development tooling)
- Tailwind CSS (utility‑first styling approach)
- Monaco Editor integration (browser‑based code editing experience)
- WebSocket client support for real‑time contest updates

### 9.2 Backend Technologies
- Node.js runtime
- Express.js web framework for REST APIs
- WebSocket server for low‑latency leaderboard updates
- JWT‑based authentication with secure cookie handling
- Middleware‑based security and rate limiting

### 9.3 Database and Storage
- MongoDB for operational data persistence (users, problems, submissions, contests)
- Redis for leaderboard caching and low‑latency aggregates
- Chroma Vector Database for AI memory and retrieval

### 9.4 AI and ML Subsystem
- Python‑based microservice using FastAPI
- Multi‑agent workflow orchestration (agentic architecture)
- Retrieval‑augmented memory to personalize feedback over time

### 9.5 External Services and Integrations
- Piston API for sandboxed, multi‑language code execution

### 9.6 Deployment Environment (High‑Level)
- **Recommended for academic demonstration:** Local deployment using separate services for frontend, backend, and AI service.
- **Scalable production direction:** Cloud or hybrid deployment with managed database services, containerized microservices, and secure API gateways.

---

## 10. Security Considerations

### 10.1 Authentication
- The system employs token‑based authentication to ensure that only registered users can submit solutions and participate in contests.
- Secure session handling prevents exposure of sensitive session data to client‑side scripts.

### 10.2 Authorization
- Role‑based access control separates administrator capabilities from general user capabilities.
- Administrative features (problem and test case management, bulk imports) are restricted to authorized roles.

### 10.3 Data Protection
- Sensitive user data (e.g., passwords) is stored in a protected form consistent with industry practice.
- Communication between client and server is designed to operate over secure transport (HTTPS) in production environments.

### 10.4 Input Validation and Threat Mitigation
- The system validates and sanitizes inputs to reduce risks of injection attacks.
- Rate limiting reduces the risk of brute force attempts and abuse of endpoints.
- User code is not executed on the platform’s infrastructure; instead, execution is delegated to a sandboxed external service, reducing risk from untrusted code.
- Hidden test cases are protected to preserve evaluation integrity and limit “test leakage.”

---

## 11. Performance & Scalability

### 11.1 System Responsiveness
- The platform is designed to provide quick feedback loops for learning, particularly for “Run” operations and basic navigation.
- Live contest leaderboards use WebSockets to avoid repeated polling and to maintain near real‑time updates.

### 11.2 Scalability Strategy
- **Horizontal scaling of stateless services:** Frontend hosting and backend API servers can be replicated behind a load balancer.
- **Independent scaling of AI service:** AI feedback generation can be scaled separately based on demand, reducing impact on core judging throughput.
- **Caching and fast leaderboards:** Leaderboard updates and reads are optimized through a dedicated in‑memory store.

### 11.3 High‑Level Optimization Approach
- Reduce round‑trip time by minimizing payload sizes and returning only necessary result summaries.
- Separate contest real‑time traffic from standard API traffic where possible.
- Use dedicated stores for operational data versus memory retrieval to avoid mixed workloads.

---

## 12. Assumptions & Constraints

### 12.1 Assumptions
- Users have access to a modern web browser and stable internet connectivity.
- The external sandbox execution service is available and responsive.
- Problem definitions and test cases are curated to ensure correct evaluation.
- AI feedback is designed as guidance, not as a replacement for learning effort; it is expected to avoid revealing full solutions.

### 12.2 Constraints
- **Execution constraints:** The platform depends on an external executor and is bounded by its supported languages and runtime limits.
- **Operational constraints:** Contest peaks may increase concurrent requests, requiring caching and real‑time infrastructure.
- **Data constraints:** Storage growth occurs with submissions and memory traces; retention strategies may be required in long‑term deployments.
- **Academic constraints:** For college demonstrations, deployments may be limited to local machines with finite resources.

---

## 13. Advantages of the Proposed System

- Provides learning‑oriented feedback beyond simple pass/fail verdicts.
- Maintains persistent user learning memory to improve personalization over time.
- Supports real‑time contests with live leaderboards and low latency.
- Improves security posture by delegating code execution to a sandboxed external service.
- Offers administrative tools for efficient content creation and bulk ingestion.
- Modular architecture improves maintainability and supports future enhancements.

---

## 14. Limitations & Future Enhancements

### 14.1 Current Limitations
- Dependence on the availability and performance of the external code execution service.
- AI feedback quality may vary based on model behavior and input context.
- Large‑scale deployments may require additional observability, cost controls, and stricter governance.

### 14.2 Possible Future Improvements
- Add offline/queued evaluation modes to reduce dependency on a single executor.
- Expand analytics for learning outcomes and contest performance.
- Add more robust plagiarism detection workflows and reporting.
- Introduce adaptive learning paths as a first‑class feature with curriculum sequencing.
- Provide institution‑specific deployments with multi‑tenant separation.

---

## 15. Conclusion

This High Level Design presents Arrakis Labs (Mentat Trials) as an integrated competitive programming and learning platform that combines automated judging, real‑time contests, and AI‑assisted mentorship. The architecture intentionally separates the core platform from AI computation and external code execution to improve maintainability, scalability, and security. By shifting feedback from verdict‑centric outputs toward personalized learning guidance, the system addresses a common educational limitation of conventional online judges and offers a scalable foundation for future academic and product evolution.

---

# Instructions to Create Colored Block Diagrams

This section provides step‑by‑step instructions to recreate the diagrams in draw.io (diagrams.net) or PowerPoint using colored blocks. Use consistent box naming and arrow directions as described.

## A. General Diagram Styling (Applicable to All)

1. **Page setup:** Use A4 portrait for the HLD document figures. In PowerPoint, use a blank slide with A4 ratio if available; otherwise use a standard slide and export as image for embedding.
2. **Font recommendation:** Calibri / Segoe UI / Inter; 12–16 pt for box titles.
3. **Color palette (mandatory mapping):**
   - **Users:** Light Blue
   - **Frontend:** Green
   - **Backend Services:** Orange
   - **Database:** Purple
   - **External Services:** Grey
4. **Arrow style:** Use solid arrows with a medium thickness. Prefer vertical flow (top to bottom) for readability.
5. **Grouping:** Where multiple subcomponents belong to one major component (e.g., backend submodules), place them inside a larger container box with a title.

## B. System Architecture Diagram (Colored Block Diagram)

**Diagram Title:** “High‑Level System Architecture of Arrakis Labs (Mentat Trials)”

### B.1 Boxes to Draw (Exact Names)

1. **Users (Light Blue)**
   - Box text: “End Users (Learners / Contest Participants)”
   - Box text: “Administrators”

2. **Frontend (Green)**
   - Box text: “Frontend Web Application (React SPA)”
   - Optional subtext line: “Problem UI • Code Editor • Admin Panel • Contest UI”

3. **Backend (Orange)**
   - Large container box text: “Backend Server (REST API + WebSocket Gateway)”
   - Inside container (smaller orange boxes, optional but recommended):
     - “Auth & Access Control”
     - “Problem & Submission APIs”
     - “Contest & Scheduler”
     - “Leaderboard Publisher”
     - “AI Service Client”

4. **Databases (Purple)**
   - Box text: “MongoDB (Operational Data)”
   - Box text: “Redis (Leaderboard / Cache)”
   - Box text: “Chroma DB (Vector Memory Store)”

5. **External Services (Grey)**
   - Box text: “Piston API (Sandboxed Code Execution)”
   - Box text: “AI Service (FastAPI + Agentic Workflow)”

### B.2 Arrow Directions (Exact)

- “End Users (Learners / Contest Participants)” → “Frontend Web Application (React SPA)”
- “Administrators” → “Frontend Web Application (React SPA)”
- “Frontend Web Application (React SPA)” → “Backend Server (REST API + WebSocket Gateway)” (label: “REST APIs (HTTPS)”) 
- “Backend Server (REST API + WebSocket Gateway)” → “Frontend Web Application (React SPA)” (label: “Responses + WebSocket Events”)
- “Backend Server (REST API + WebSocket Gateway)” → “MongoDB (Operational Data)”
- “Backend Server (REST API + WebSocket Gateway)” → “Redis (Leaderboard / Cache)”
- “Backend Server (REST API + WebSocket Gateway)” → “Piston API (Sandboxed Code Execution)”
- “Backend Server (REST API + WebSocket Gateway)” → “AI Service (FastAPI + Agentic Workflow)”
- “AI Service (FastAPI + Agentic Workflow)” → “Chroma DB (Vector Memory Store)”

### B.3 Placement Suggestion
- Top row: Users (two boxes side‑by‑side)
- Second row: Frontend (centered)
- Third row: Backend (centered, larger container)
- Bottom row: Databases (MongoDB, Redis, Chroma) in a line
- Right side: External services (Piston API, AI Service) aligned with backend

## C. DFD Level 0 (Context Diagram)

**Diagram Title:** “DFD Level 0 (Context Diagram) — Arrakis Labs Platform”

### C.1 Entities and Process

- **External Entities (Light Blue):**
  - “End Users”
  - “Administrators”
- **Central Process (Orange):**
  - “Arrakis Labs Platform”
- **External Services (Grey):**
  - “Piston API (Executor)”
  - “AI Service”
- **Data Stores (Purple):**
  - “MongoDB”
  - “Redis”
  - “Chroma DB”

### C.2 Data Flow Arrows

- “End Users” ↔ “Arrakis Labs Platform” (label: “Problem Solving, Submissions, Feedback, Contests”)
- “Administrators” ↔ “Arrakis Labs Platform” (label: “Content Management, Monitoring”)
- “Arrakis Labs Platform” ↔ “Piston API (Executor)” (label: “Execute Code / Receive Results”)
- “Arrakis Labs Platform” ↔ “AI Service” (label: “Feedback Request / Feedback Response”)
- “Arrakis Labs Platform” ↔ “MongoDB” (label: “Users, Problems, Submissions, Contests”)
- “Arrakis Labs Platform” ↔ “Redis” (label: “Leaderboard State / Fast Aggregates”)
- “AI Service” ↔ “Chroma DB” (label: “Retrieve/Store Learning Memory”) 

### C.3 Placement Suggestion
- Center: “Arrakis Labs Platform”
- Left: users/admins
- Right: external services
- Bottom: data stores

## D. DFD Level 1 (Decomposition Diagram)

**Diagram Title:** “DFD Level 1 — Core Processes of Arrakis Labs Platform”

### D.1 Processes (Orange Boxes)
Create the following numbered process boxes:

1. “Authenticate User / Admin”
2. “Authorize Request (Role Check)”
3. “Serve Problems & Contest Data”
4. “Handle Run/Submit Request”
5. “Orchestrate Code Execution”
6. “Persist Submission & Results”
7. “Generate AI Feedback (If Needed)”
8. “Update Contest Scoring & Leaderboard”
9. “Broadcast Live Updates (WebSocket)”

### D.2 Data Stores (Purple Boxes)
- “MongoDB (Operational Data)”
- “Redis (Leaderboard/Cache)”
- “Chroma DB (Vector Memory)”

### D.3 External Services (Grey Boxes)
- “Piston API (Sandboxed Executor)”
- “AI Service (Feedback Engine)”

### D.4 Arrow Directions (Suggested Minimal Set)

- Users/Admins → (1) Authenticate User / Admin
- (1) → MongoDB (Operational Data) (label: “Validate Identity / Fetch Profile”)
- (1) → (2) Authorize Request (Role Check)
- (2) → (3) Serve Problems & Contest Data
- (3) ↔ MongoDB (Operational Data)
- Users → (4) Handle Run/Submit Request
- (4) → (5) Orchestrate Code Execution
- (5) ↔ Piston API (Sandboxed Executor)
- (5) → (6) Persist Submission & Results
- (6) ↔ MongoDB (Operational Data)
- (6) → (7) Generate AI Feedback (If Needed)
- (7) ↔ AI Service (Feedback Engine)
- AI Service (Feedback Engine) ↔ Chroma DB (Vector Memory)
- (6) → (8) Update Contest Scoring & Leaderboard
- (8) ↔ Redis (Leaderboard/Cache)
- (8) → (9) Broadcast Live Updates (WebSocket)
- (9) → Users (label: “Leaderboard Update Events”)

### D.5 Placement Suggestion
- Arrange processes in a left‑to‑right or top‑to‑bottom pipeline; keep “Run/Submit” and “Execution” processes centrally.
- Place data stores beneath the processes they serve.
- Place external services to the right side to emphasize dependency.

## E. Diagram Placement in HLD

- Insert the **System Architecture Diagram** in Section 6 (System Architecture), immediately after the architecture explanation.
- Insert **DFD Level 0** at the start of Section 8 (Data Flow Description).
- Insert **DFD Level 1** after DFD Level 0 in Section 8.
- Keep diagram captions consistent with the titles provided above.
