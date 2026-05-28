# SheryAI — AI-Native Knowledge Operating System

> **Transform any lecture, video, or document into a living knowledge workspace with semantic search, AI tutoring, and intelligent content synthesis.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Qdrant](https://img.shields.io/badge/vector_db-Qdrant-red)](https://qdrant.tech/)
[![Firebase](https://img.shields.io/badge/database-Firestore-orange)](https://firebase.google.com/)
[![BullMQ](https://img.shields.io/badge/queue-BullMQ-purple)](https://docs.bullmq.io/)

---

## Overview

SheryAI is a full-stack AI learning platform built for educators and students. It combines:

- **Grounding Playground** — Semantic chat grounded against your uploaded sources (PDFs, YouTube videos, lectures)
- **Knowledge Intelligence** — Auto-generated concept graphs, topic maps, prerequisite chains, and knowledge gap analysis
- **Studio Labs** — AI-synthesized study guides, flashcard decks, practice exams, FAQ documents, timelines, and more
- **Real-time Ingestion Pipeline** — Streaming transcription → chunking → embedding → vector indexing with live status visibility

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                   │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │  Workspace   │  │ Grounding Chat  │  │   Studio Labs     │   │
│  │  Sidebar     │  │  (Playground)   │  │  (AI Synthesis)   │   │
│  └──────────────┘  └─────────────────┘  └───────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │          Knowledge Intelligence Dashboard                 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                  Deployed on: Vercel                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS/REST
┌────────────────────────────▼────────────────────────────────────┐
│                    Backend API (Express.js)                       │
│  /api/health  /api/lessons  /api/chat  /api/workspaces           │
│                  Deployed on: Railway / Cloud Run                │
└──────────────┬─────────────────────────────────────────────────┘
               │
       ┌───────▼────────┐      ┌──────────────────────┐
       │   BullMQ Queue │      │   Firebase Firestore  │
       │  (Redis-backed)│      │  (Workspaces, Sources │
       │                │      │   Chat Sessions)      │
       └───────┬────────┘      └──────────────────────┘
               │
       ┌───────▼────────────────────────────────────────┐
       │              Ingestion Workers                   │
       │  ┌────────────┐  ┌──────────┐  ┌───────────┐   │
       │  │ PDF Parser │  │ YouTube  │  │   Local   │   │
       │  │ (pdf-parse)│  │ Pipeline │  │   Video   │   │
       │  └────────────┘  └──────────┘  └───────────┘   │
       └───────┬────────────────────────────────────────┘
               │
       ┌───────▼───────────────────────────────────────┐
       │              Embedding & Vector Layer           │
       │  NVIDIA NIM Embeddings → Qdrant Cloud          │
       │  (Hybrid BM25 + Dense Vector Search)           │
       └───────────────────────────────────────────────┘
               │
       ┌───────▼───────────────────────────────────────┐
       │         AI Intelligence Layer                   │
       │  AssemblyAI (transcription) → NVIDIA NIM Chat  │
       └───────────────────────────────────────────────┘
               │
       ┌───────▼───────────────────────────────────────┐
       │         Storage                                 │
       │  Local (dev) | Supabase Storage (production)   │
       └───────────────────────────────────────────────┘
```

---

## Free-Tier Production Stack

SheryAI is designed to run **at zero cost** on free tiers:

| Layer | Service | Free Tier |
|---|---|---|
| **Frontend** | Vercel | Free hobby plan |
| **Backend API** | Railway | $5/month credit |
| **Workers** | Railway | Same service |
| **Database** | Firebase Firestore | Free Spark plan |
| **Queue** | Upstash Redis | Free 10K/day |
| **Vector DB** | Qdrant Cloud | Free 1GB cluster |
| **File Storage** | **Supabase Storage** | **Free 1GB** |
| **Transcription** | AssemblyAI | Pay-as-you-go |
| **Embeddings** | NVIDIA NIM | Free tier |
| **AI Chat** | NVIDIA NIM | Free tier |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite | SPA with optimistic UI |
| **Styling** | Tailwind CSS v4 + Vanilla CSS | Design system |
| **Animation** | Framer Motion | Micro-interactions |
| **State** | TanStack React Query | Server state cache |
| **Backend** | Express.js (ESM) | REST API |
| **Database** | Firebase Firestore | Workspaces, sources, sessions |
| **Queue** | BullMQ (Redis) | Background ingestion jobs |
| **Vector DB** | Qdrant Cloud | Semantic search index |
| **Embeddings** | NVIDIA NIM (`nv-embedqa-mistral-7b-v2`) | Dense vector generation |
| **Transcription** | AssemblyAI | Video/audio → text |
| **AI Chat** | NVIDIA NIM (`nemotron`) | Grounded Q&A generation |
| **Storage** | Supabase Storage | File uploads (PDFs, videos) |
| **Logging** | Winston + Morgan | Structured production logs |
| **Security** | Helmet, express-rate-limit, CORS | API hardening |

---

## Monorepo Structure

```
SheryAI/
├── apps/
│   ├── client/               # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── workspace/   # Knowledge Workspace UI
│   │   │   ├── pages/           # Route-level pages
│   │   │   ├── api/             # React Query hooks
│   │   │   ├── hooks/           # Custom hooks
│   │   │   └── services/        # Client-side services
│   │   ├── .env.example
│   │   └── vite.config.js
│   │
│   └── server/               # Express backend
│       ├── src/
│       │   ├── config/          # Firebase, env, etc.
│       │   ├── controllers/     # Route handlers
│       │   ├── services/
│       │   │   └── workspace/   # Ingestion pipeline (32 services)
│       │   ├── infrastructure/  # Redis, BullMQ queues
│       │   ├── worker/          # BullMQ workers
│       │   ├── repositories/    # Firestore repositories
│       │   ├── middleware/       # Auth, rate-limit, CORS
│       │   └── routes/          # API routes
│       ├── Dockerfile
│       ├── server.js            # Entry point
│       └── .env.example
│
├── docker-compose.yml           # Local dev (Redis, Qdrant, Firestore emulator)
├── turbo.json                   # Turborepo pipeline
└── package.json
```

---

## Local Development

### Prerequisites

- Node.js ≥ 20.0.0
- Docker & Docker Compose (for Redis + Qdrant + Firestore emulator)
- `ffmpeg` installed locally (for video segmentation)

### 1. Start infrastructure services

```bash
docker-compose up -d
```

This starts:
- **Redis** on `6379` (BullMQ job queue)
- **Qdrant** on `6333` (vector database)
- **Firestore emulator** on `8080`

### 2. Configure environment variables

```bash
# Backend
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your credentials

# Frontend
cp apps/client/.env.example apps/client/.env
```

### 3. Install dependencies and start

```bash
npm install           # Install all workspace deps
npm run dev           # Start frontend + backend concurrently (Turborepo)
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:5001`.

---

## Environment Variables

### Backend (`apps/server/.env`)

```env
# ── Runtime ────────────────────────────────────────────
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:5173

# ── Firebase Admin (server-side only, NEVER expose to client) ──
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# ── Redis (BullMQ) ──────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379

# ── Qdrant Vector Database ──────────────────────────────
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=                     # Required for Qdrant Cloud

# ── AI Services ─────────────────────────────────────────
NVIDIA_API_KEY=nvapi-...
NVIDIA_MODEL=nvidia/nemotron-3-nano-30b-a3b
NVIDIA_EMBEDDING_MODEL=nvidia/nv-embedqa-mistral-7b-v2
ASSEMBLYAI_API_KEY=...

# ── Transcription ────────────────────────────────────────
TRANSCRIPTION_PROVIDER=assemblyai

# ── Storage (Supabase in production, local in dev) ──────
STORAGE_PROVIDER=local              # local | supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_STORAGE_BUCKET=workspace-assets
SUPABASE_SIGNED_URL_TTL_SECONDS=3600

# ── CORS ─────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:5173,https://your-prod-domain.com
ALLOW_VERCEL_PREVIEWS=false         # Set true for Vercel preview URLs

# ── Knowledge Workspace Limits ───────────────────────────
WORKSPACE_FREE_LIMIT=5
WORKSPACE_SOURCE_LIMIT=10
WORKSPACE_MAX_PDF_MB=20
```

### Frontend (`apps/client/.env`)

```env
VITE_API_BASE_URL=http://localhost:5001
VITE_API_DIRECT_URL=http://localhost:5001
```

> **Security Note**: Never put Firebase Admin keys, NVIDIA keys, or AssemblyAI keys in `VITE_` prefixed variables — they will be bundled into the public JS bundle.

---

## Deployment

### Frontend → Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from client directory
cd apps/client
vercel --prod
```

Set these environment variables in Vercel Dashboard:
- `VITE_API_BASE_URL` → your backend Railway/Cloud Run URL

### Backend → Railway

```bash
# Using Railway CLI
railway login
railway init
railway up
```

Set all backend environment variables in Railway's dashboard. Railway will automatically detect Node.js and run `npm start`.

### Backend → Cloud Run (alternative)

```bash
# Build and push Docker image
cd apps/server
docker build -t gcr.io/YOUR_PROJECT/sheryai-backend:latest .
docker push gcr.io/YOUR_PROJECT/sheryai-backend:latest

# Deploy
gcloud run deploy sheryai-backend \
  --image gcr.io/YOUR_PROJECT/sheryai-backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,..."
```

### Required Cloud Services (Production — Free Tier Stack)

| Service | Purpose | Provider |
|---|---|---|
| **Redis** | BullMQ job queue | Upstash Redis (free 10K/day) |
| **Vector DB** | Semantic search | Qdrant Cloud (free 1GB) |
| **File Storage** | PDF/video uploads | **Supabase Storage (free 1GB)** |
| **Transcription** | Video → text | AssemblyAI (pay-as-you-go) |
| **Embeddings** | Dense vectors | NVIDIA NIM API (free tier) |
| **Chat AI** | Grounded answers | NVIDIA NIM API (free tier) |
| **Database** | Workspaces, sources | Firebase Firestore (free Spark) |

> **Supabase Storage Setup:**
> 1. Create a project at [supabase.com](https://supabase.com)
> 2. Go to Storage → Create bucket named `workspace-assets` (set to **Private**)
> 3. Copy your Project URL and **Service Role Key** (from Settings → API)
> 4. Set `STORAGE_PROVIDER=supabase` in your backend env

---

## Ingestion Pipeline

SheryAI's ingestion pipeline processes uploaded sources through a 7-stage state machine:

```
PENDING → VALIDATING → TRANSCRIBING → CHUNKING → EMBEDDING → INDEXING → READY
                                                                    ↕
                                                              (BM25 Fallback)
```

Each stage is tracked in Firestore and surfaced in real-time in the UI. Sources enter "Degraded (BM25 Fallback)" mode only if vector indexing fails — the system remains fully functional with keyword-based retrieval.

---

## Security

- **Helmet**: Sets 13 security HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS**: Strict allowlist-based origin validation with optional Vercel preview support
- **Rate Limiting**: 200 req/15min globally, 30 req/min on chat endpoints
- **Firebase Auth**: All workspace routes require valid Firebase ID tokens
- **Env Isolation**: Zero backend secrets in frontend bundles (enforced by `VITE_` prefix convention)
- **Non-root Docker**: Container runs as `appuser` (not root)

---

## Testing

```bash
# Backend integration tests (11 tests)
npm run test --prefix apps/server

# Frontend unit tests
npm run test --prefix apps/client
```

---

## License

ISC — © SheryAI
