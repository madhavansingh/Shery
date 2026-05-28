<div align="center">

# SheryAI

### Next-Generation AI-Native Knowledge Operating System for Video Lectures

[![Production Build](https://github.com/madhavansingh/Shery/actions/workflows/build.yml/badge.svg)](https://github.com/madhavansingh/Shery/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Qdrant Cloud](https://img.shields.io/badge/Vector_DB-Qdrant_Cloud-red.svg)](https://qdrant.tech/)
[![Firebase Spark](https://img.shields.io/badge/Database-Firestore_Spark-orange.svg)](https://firebase.google.com/)
[![BullMQ Engine](https://img.shields.io/badge/Queue-BullMQ_Engine-purple.svg)](https://docs.bullmq.io/)
[![Supabase Storage](https://img.shields.io/badge/Storage-Supabase_Storage-green.svg)](https://supabase.com/)

**Transform any lecture, raw video, or academic document into a living, fully interactive knowledge workspace with semantic search, cognitive tutoring, and real-time concept synthesis.**

[Architecture](#✦-complete-system-architecture) • [Ingestion Pipeline](#✦-ai-ingestion-pipeline) • [Streaming Engine](#✦-streaming-ai-response-pipeline) • [Vector Retrieval](#✦-vector-retrieval-architecture) • [Deployment](#✦-production-infrastructure)

</div>

---

## ✦ Built for the Future of Intelligent Learning

Passive learning is fundamentally broken. Students spend hundreds of hours watching video lectures and reading massive documents, yet the knowledge inside remains static, un-searchable, and disconnected. 

SheryAI re-imagines lectures as dynamic knowledge graphs. By integrating deep semantic vector indexing with real-time audio transcription and a production-grade RAG pipeline, it allows learners to converse with their course materials, query topics through hybrid semantic searches, generate study guides, and visual-map cognitive milestones.

> [!IMPORTANT]
> **SheryAI is not a simple chatbot wrapper.** It is an enterprise-grade ingestion and retrieval infrastructure stack designed to process, segment, embed, index, and query unstructured media at scale with absolute grounding and zero hallucinations.

---

## ✦ Product Experience

SheryAI shifts the paradigm of digital learning from passive consumption to active dialogue:

* **Ingest and Transcribe**: Upload lecture recordings, PDFs, YouTube URLs, or audio clips.
* **Intelligent Synthesis**: The platform automatically partitions resources, extracts semantic tags, translates audio to text, and indexes content vectors.
* **Grounded Chat**: Converse with a dedicated AI Tutor whose responses are mathematically locked to your source documents to eliminate hallucinations.
* **Interactive Timestamps**: Click inline chat citations to instantly jump to the exact second in the video where a topic was discussed.
* **Assessment Labs**: Instantly synthesize flashcards, quiz pools, chronological timelines, and knowledge gap analyses.

---

## ✦ Platform Preview

## 1. Landing Page

Modern AI-native onboarding interface with cinematic gradients, adaptive layout system, and semantic navigation architecture.

<div align="center">
  <img src="./assets/readme/landing-page.png" alt="SheryAI Landing Page" width="100%" />
</div>

---

## 2. AI Workspace

Unified academic intelligence workspace integrating lecture ingestion, document synchronization, semantic retrieval, and contextual memory systems.

<div align="center">
  <img src="./assets/readme/workspace-dashboard.png" alt="SheryAI Workspace" width="100%" />
</div>

---

## 3. Lecture Intelligence

Real-time audio extraction, transactional state tracking, and state machine virtualization pipeline converting media files into transcription segments.

<div align="center">
  <img src="./assets/readme/lecture-intelligence.png" alt="SheryAI Lecture Intelligence" width="100%" />
</div>

---

## 4. Semantic Tutor

Context-locked learning dialog interface supporting temporal references, interactive video synchronization, and grounded cognitive chat.

<div align="center">
  <img src="./assets/readme/semantic-tutor.png" alt="SheryAI Semantic Tutor" width="100%" />
</div>

---

## 5. Knowledge Dashboard

Unified academic diagnostic suite presenting automated flashcards, quiz generation, cognitive gap analysis, and interactive lesson timelines.

<div align="center">
  <img src="./assets/readme/knowledge-dashboard.png" alt="SheryAI Knowledge Dashboard" width="100%" />
</div>

---

## 6. AI Search Experience

High-performance search interface utilizing Reciprocal Rank Fusion (RRF) to merge semantic vector queries with lexical BM25 database scoring.

<div align="center">
  <img src="./assets/readme/ai-search.png" alt="SheryAI AI Search Experience" width="100%" />
</div>

---

## ✦ Complete System Architecture

SheryAI is built on a highly decoupled, async-first architecture. It segregates API routing, heavy background compute workers, vector storage, and state tracking to prevent thread blocking and memory inflation.

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Interface (SPA)"]
        UI["React 18 + Vite App"]
        TQuery["TanStack React Query Cache"]
        UI <--> TQuery
    end

    subgraph APILayer ["API Routing & Security"]
        Gateway["Express.js Web Server"]
        RateLimit["Rate Limiter (200 req/15m)"]
        Auth["Firebase JWT Authenticator"]
        
        Gateway --> RateLimit
        Gateway --> Auth
    end

    subgraph QueueLayer ["Orchestration & State Queue"]
        BullMQ["BullMQ Ingestion Queue"]
        Redis["Upstash Redis Singleton"]
        BullMQ <--> Redis
    end

    subgraph DataStore ["Production Data Cluster"]
        Firestore["Cloud Firestore (Metadata)"]
        Storage["Supabase Storage (Raw Files)"]
    end

    subgraph WorkerLayer ["Async Worker Cluster (Isolated Nodes)"]
        Worker1["Ingestion Worker (YouTube/PDF)"]
        Worker2["Workspace Video Worker (FFmpeg)"]
    end

    subgraph AISubsystem ["AI Inference & RAG Cluster"]
        NVIDIA["NVIDIA NIM (Nemotron LLM)"]
        NIM_Embed["NVIDIA NIM (Mistral Embeddings)"]
        Qdrant["Qdrant Cloud (Vector Index)"]
        Assembly["AssemblyAI (Speech-to-Text)"]
    end

    UI -- "HTTPS / Event Stream" --> Gateway
    Gateway -- "Enqueue Job" --> BullMQ
    Gateway -- "Write Metadata" --> Firestore
    Gateway -- "Upload Object" --> Storage

    BullMQ -- "De-queue Task" --> Worker1
    BullMQ -- "De-queue Task" --> Worker2

    Worker1 & Worker2 -- "Pull Blob" --> Storage
    Worker1 & Worker2 -- "Submit Audio" --> Assembly
    Worker1 & Worker2 -- "Generate Vectors" --> NIM_Embed
    Worker1 & Worker2 -- "Write Vectors" --> Qdrant
    Worker1 & Worker2 -- "Update Status" --> Firestore

    Gateway -- "Hybrid Search Query" --> Qdrant
    Gateway -- "Context-Aware Gen" --> NVIDIA
```

---

## ✦ AI Ingestion Pipeline

The platform utilizes a strict 7-stage transactional state machine. Every step is logged as a state checkpoint in Firestore and piped directly to the user interface in real time.

```mermaid
stateDiagram-v2
    [*] --> PENDING : File Submitted / API Request Received
    PENDING --> VALIDATING : Worker Pulls Job from Queue
    
    state VALIDATING {
        [*] --> CheckMimeType
        CheckMimeType --> CheckSize
        CheckSize --> CharacterDensityCheck : PDF
        CheckSize --> CheckDuration : Video
    }

    VALIDATING --> TRANSCRIBING : Validation Passes
    state TRANSCRIBING {
        [*] --> SplitAudio : Local Video
        SplitAudio --> UploadToAssemblyAI
        UploadToAssemblyAI --> PollTranscriptionResult
    }

    TRANSCRIBING --> CHUNKING : Transcript Ready
    state CHUNKING {
        [*] --> SemanticTokenSplit
        SemanticTokenSplit --> ApplyOverlapOffset : Token Window 384 / Overlap 48
    }

    CHUNKING --> EMBEDDING : Chunks Generated
    state EMBEDDING {
        [*] --> NVIDIA_NIM_BatchEmbed
        NVIDIA_NIM_BatchEmbed --> FormatVectors : 1024 Dimensions
    }

    EMBEDDING --> INDEXING : Vectors Available
    state INDEXING {
        [*] --> Qdrant_Upsert
        Qdrant_Upsert --> CreatePayloadIndexes : workspaceId & sourceId
    }

    INDEXING --> READY : Ingestion Success
    INDEXING --> DEGRADED : Vector Indexing Failure (Non-Fatal)
    
    DEGRADED --> READY : Fallback to BM25 Lexical Matching
    READY --> [*]
```

<details>
<summary><b>Detailed Pipeline Stage Explanations</b></summary>

### 1. Verification (VALIDATING)
* **Envelope Checks**: Validates files against strict parameters (e.g. maximum PDF size limits, audio track existence, and mime verification).
* **Character Density Diagnostics**: Scans PDF text density using class-based `PDFParse` systems to flag scanned page vectors that require image extraction.

### 2. Audio Extraction & Transcription (TRANSCRIBING)
* **FFmpeg Demuxing**: Video uploads are processed using sandboxed `ffmpeg` execution. The system isolates the raw audio channel and exports it into a compressed Mono-channel MP3 stream.
* **Speech to Text**: Streams audio segments to AssemblyAI endpoints. Implements continuous polling loops with custom fallback parameters.

### 3. Overlap Chunking (CHUNKING)
* **Token Boundaries**: Splits raw transcript strings into semantic text blocks.
* **Overlap Window**: Employs a token limit config of `384` with a safety overlap window of `48` tokens, ensuring context is preserved across split boundaries.

### 4. Multi-Dimensional Embedding (EMBEDDING)
* **NVIDIA NIM Generation**: Streams text blocks in batches to the `nv-embedqa-mistral-7b-v2` embedding engine.
* **Dense Vectors**: Generates a standard float array representing 1024-dimension semantic coordinates.

### 5. Vector Indexing (INDEXING)
* **Qdrant Upsert**: Performs high-throughput batch inserts of vectors into Qdrant Cloud.
* **Payload Indexing**: Idempotently establishes payload index definitions (`workspaceId` and `sourceId`) inside Qdrant collections to ensure sub-millisecond search latencies under concurrent workspace queries.
</details>

---

## ✦ Streaming AI Response Pipeline

To deliver a premium, near-instant user interface, responses are computed and streamed using Server-Sent Events (SSE). We wired cancelable abort signals from the browser directly to the inference layers to prevent orphaned processing costs.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Browser
    participant API as API Web Server
    participant Vector as Vector Engine (Qdrant)
    participant Model as NVIDIA NIM Inference
    
    Student->>API: POST /api/workspaces/:id/chats (with AbortSignal)
    Note over API: Initialize Express Request
    
    API->>Vector: Hybrid Search (Workspace Vectors + BM25)
    Vector-->>API: Scored Context Chunks (Top-K)
    
    API->>API: Compile Context Prompts & Cognitive Guardrails
    
    API->>Model: generateContentStream(Prompt, AbortSignal)
    
    loop Stream Tokens
        Model-->>API: Stream Data Chunk
        API-->>Student: Server-Sent Event (SSE Token stream)
        Note over Student: Render Token Stream in UI (Optimistic Rendering)
    end
    
    alt User Closes Tab / Cancels Stream
        Student->>API: Abort Request (TCP Close)
        Note over API: Detect Request Closure (req.on('close'))
        API->>Model: Trigger AbortController.abort()
        Note over Model: Terminate Upstream Completion Stream
        API->>API: Clean Temporary Memory Allocations
    end
    
    Model-->>API: Stream End
    API-->>Student: Close SSE Connection
```

---

## ✦ Queue Orchestration System

SheryAI handles CPU-intensive task ingestion asynchronously using a Redis-backed queue system. This isolates heavy operations from request-handling API processes.

```mermaid
flowchart LR
    subgraph API_Nodes ["Web API Nodes (Express)"]
        Node1["sheryai-api (Node 1)"]
        Node2["sheryai-api (Node 2)"]
    end

    subgraph Redis_Cluster ["Queue State Storage"]
        Redis["Upstash Redis Serverless"]
    end

    subgraph Queue_Registry ["BullMQ Queues"]
        Q1["ingestion-queue"]
        Q2["workspace-ingestion-queue"]
        Q3["workspace-upload-queue"]
    end

    subgraph Worker_Fleet ["Worker Nodes (Dedicated Services)"]
        W1["ingestion.worker.js"]
        W2["workspace.worker.js"]
        W3["workspaceUpload.worker.js"]
    end

    API_Nodes -- "Enqueue Ingestion Jobs" --> Q1 & Q2 & Q3
    Q1 & Q2 & Q3 <--> Redis
    
    Redis -- "Job Distribution & Locks" --> Worker_Fleet
    W1 -- "Process YouTube / PDF" --> Q1
    W2 -- "Process Text / Enrichment" --> Q2
    W3 -- "Process Local Video (FFmpeg)" --> Q3
```

### Queue Resilience Architecture
* **Isolated Processing**: Background workers run as distinct, decoupled nodes. If a heavy FFmpeg encoding task crashes a worker container, the main Express API server continues handling traffic without interruption.
* **Concurrency Capping**: Configures strict limits on active concurrent processes (`concurrency: 2` for general ingestion, `concurrency: 3` for uploads) to prevent background CPU exhaustion on host systems.
* **Redis Connection Singleton**: All queues and workers reuse the same centralized, validated connection singleton exported from `redis.js`, ensuring we do not exhaust Redis connection limits.
* **Task Lock Extenders**: Spawns lock renewal processes (`lockRenewTime: 60s` on a `5-minute` lock duration) to prevent long-running transcription jobs from being misclassified as stalled and picked up twice.

---

## ✦ Vector Retrieval Architecture

SheryAI utilizes a hybrid search pipeline that combines dense vector semantic matching with classical lexical keyword lookups to deliver optimal grounded context results.

```mermaid
flowchart TD
    Query["User Search / Chat Query"] --> Expansion["NVIDIA NIM Query Expansion"]
    
    subgraph VectorSearch ["Level 1: Semantic Vector Path"]
        NIM_Embed["NVIDIA NIM Embeddings Generator"]
        Qdrant["Qdrant Cloud Cosine Search"]
        
        Expansion --> NIM_Embed --> Qdrant
    end
    
    subgraph LexicalSearch ["Level 2: Lexical Fallback Path"]
        Tokenize["Text Tokenizer & Stopword Filter"]
        BM25["BM25 Lexical Scorer"]
        
        Expansion --> Tokenize --> BM25
    end

    Qdrant --> RRF["Reciprocal Rank Fusion (RRF)"]
    BM25 --> RRF
    
    RRF --> DiversityFilter["Source Diversity Filter (Max 60% per source)"]
    DiversityFilter --> ContextBuilder["Top-K Scored Context Chunks"]
```

### Retrieval Layer Mechanics
* **Query Expansion**: Utilizes the fast NVIDIA Nemotron model to rewrite raw query inputs into a list of synonymous academic keywords, increasing the surface area for semantic searches.
* **Reciprocal Rank Fusion (RRF)**: Merges ranked results from semantic cosine searches and lexical keyword matching into a single, high-fidelity score:
  $$RRF\_Score(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
  where $k=60$ and $r_m(d)$ is the rank of document $d$ in the system path $m$.
* **Source Diversity Capping**: Limits the number of results from any single file to a maximum of **`60%`** of the total top-K return block. This ensures that the context provided to the model is diverse, rather than being dominated by a single source.

---

## ✦ Worker Lifecycle & Cleanup Flow

To guarantee absolute memory safety and prevent storage bloat, background workers follow a strict transactional job lifecycle, executing rollback cleanups immediately on failure.

```mermaid
stateDiagram-v2
    [*] --> Dequeue : Worker takes job
    Dequeue --> Processing : Mount Temporary Sandbox Directory
    
    state Processing {
        [*] --> RunTask
        RunTask --> Success : Job completed successfully
        RunTask --> Failure : Exceptions caught (Transcribe/Embed error)
    }

    Success --> CommitMetadata : Write 'completed' status to Firestore
    CommitMetadata --> CleanSandbox : Wipe local temp files
    CleanSandbox --> [*]

    Failure --> TriggerRollback : Rollback transaction initiated
    state TriggerRollback {
        [*] --> RollbackFirestore : Set status 'ready_without_vectors' or 'failed'
        RollbackFirestore --> PurgeSupabase : Delete orphaned draft segments
        PurgeSupabase --> PurgeQdrant : Purge dirty vector inserts
    }
    
    TriggerRollback --> CleanSandboxFailed : Always execute fs.rmSync(tempDir)
    CleanSandboxFailed --> [*]
```

---

## ✦ Production Infrastructure

The platform is designed to deploy on cost-effective serverless cloud providers, utilizing free tier limits.

```mermaid
flowchart TD
    subgraph Vercel_Network ["Vercel Edge Network"]
        Client["React Frontend Application"]
    end

    subgraph Railway_Compute ["Railway Cloud Instances"]
        API["Web API Service (sheryai-api)"]
        Worker["Worker Service (sheryai-worker)"]
    end

    subgraph Cloud_Storage ["Private Data Storage"]
        Firebase["Firebase Firestore Spark"]
        Supabase["Supabase Private File Storage"]
    end

    subgraph Queue_State ["Cache & Session Manager"]
        Upstash["Upstash Redis Cluster"]
    end

    subgraph External_AI ["Cloud Inference & NLP Services"]
        Qdrant["Qdrant Cloud Vector Cluster"]
        NVIDIA["NVIDIA NIM Gateway"]
        Assembly["AssemblyAI Serverless Engine"]
    end

    Client <--> API
    API <--> Upstash
    Worker <--> Upstash
    
    API & Worker <--> Firebase
    API & Worker <--> Supabase
    
    Worker --> Assembly
    Worker --> NVIDIA
    Worker --> Qdrant
    API --> Qdrant
    API --> NVIDIA
```

### Production Scaling Strategy
1. **Frontend Isolation**: The React application is deployed to Vercel's global edge network, ensuring fast asset delivery and static page loading.
2. **Process Segregation**:
   * **`sheryai-api`**: Configured with `RUN_API=true` and `RUN_WORKERS=false`. Exposes REST endpoints to clients.
   * **`sheryai-worker`**: Configured with `RUN_API=false` and `RUN_WORKERS=true`. Runs as an isolated worker cluster to process ingestion tasks.
3. **Serverless Cache Storage**: Utilizes Upstash Redis for BullMQ queue management. This keeps connection overhead minimal and ensures worker tasks run asynchronously.

---

## ✦ Performance Engineering

* **Connection Leak Protection**: Express controller routes listen to client connection closures and map `req.signal` downstream via custom `AbortController` boundaries. If a user cancels a query, upstream AI streams are terminated instantly to save token costs.
* **Thread-Safe Video Processing**: Background workers execute media operations within isolated sandboxed folders. Scoped `try...finally` boundaries ensure that temporary `/tmp/ws-vid-seg-*` directories are always cleaned up, even during unexpected task failures.
* **Fail-Safe Qdrant Ingestion**: Qdrant health checks feature an automatic retry backoff loop with exponential delays. If Qdrant is offline, the workspace falls back to a custom local BM25 keyword matching algorithm, keeping the application functional.

---

## ✦ Security & Reliability

* **Secure Credentials**: Production configurations block all localhost fallbacks. The application crashes immediately at startup if keys like `REDIS_URL` or `QDRANT_URL` are missing or misconfigured.
* **Helmet Hardening**: Configured 13 HTTP protection headers to defend against Cross-Site Scripting (XSS), clickjacking, and mime-sniffing exploits.
* **CORS Origin Shields**: Hardened REST gateways to allow requests exclusively from Vercel deployment domains and verified local development hosts.
* **Firebase Token Validation**: All authenticated workspace API routes enforce JWT token decoding and verify user ID matching prior to executing database queries.

---

## ✦ Design Philosophy

We believe learning should be active, conversational, and non-linear. 

Traditional lectures are linear, passive streams of information that cannot be efficiently indexed, cross-referenced, or queried. Students waste valuable hours scrubbing through timelines to find a single concept, or struggling through dense slides with no interactive context.

SheryAI shifts the paradigm. We turn static resources into conversational, structured partners. By linking interactive video control, automated vector grounding, and smart gap analysis, the application enables students to grasp complex topics faster, helps educators analyze student struggles, and ensures that knowledge is immediately accessible.

---

## ✦ Future Roadmap

* **Multimodal Retrieval**: Parse slides, visual charts, and blackboard frames into the semantic workspace context.
* **Collaborative Classrooms**: Allow multiple students to query a workspace concurrently, generating real-time group study graphs.
* **Live Lecture Capture**: Process active video streams in real-time, building interactive workspaces as the instructor speaks.
* **Autonomous Study Agents**: Spawn autonomous study agents to index research papers, test comprehension, and construct personalized study plans.

---

## ✦ Join the Future of AI Learning

SheryAI is an open-source project created to provide next-generation academic tutoring capabilities. If you love this project and want to build the future of AI learning tools with us:

* ⭐️ **Star the repository** to show your support and help other developers find us.
* 🍴 **Fork the project** and start contributing code updates.
* 🐛 **Submit issues** or feature requests on our tracker boards.

Let's build a smarter, more accessible future together.

---

*ISC License - © SheryAI*
