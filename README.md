# Guava

Guava is a Web3-native news product that combines an editorial-style frontend with an AI-assisted backend newsroom. The frontend presents categorized articles, wallet-gated premium access, and article detail pages. The backend exposes article APIs, stores content in PostgreSQL, and can run a CrewAI-based editorial pipeline to generate and publish news drafts.

## Core Features

- News homepage with category switching for Technology, Finance, Literature, Medicine, Tennis, and Network Noise
- Article detail page with metadata, verification-style presentation, and readable long-form layout
- Wallet connection flow built with RainbowKit and Wagmi
- Subscription action powered by a mock on-chain payment flow using Wagmi and Viem
- Frontend submission modal that posts user-generated articles to the backend API
- Backend article ingestion API with duplicate-title filtering
- Backend cleanup API for test articles and duplicated agent output
- AI newsroom pipeline using Scout, Writer, and Publisher agents to research, draft, and persist articles

## Project Structure

```text
guavanews/
├── frontend/   # Next.js app
└── backend/    # FastAPI + CrewAI service
```

## Tech Stack

### Frontend

- Next.js 16.1.6 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React for icons
- RainbowKit for wallet UI
- Wagmi for wallet state and blockchain hooks
- Viem for transaction value utilities
- TanStack React Query for provider integration

### Backend

- FastAPI
- Python
- SQLAlchemy
- PostgreSQL
- Supabase Postgres ready via `DATABASE_URL`
- CrewAI
- `crewai_tools`
- Tavily / Composio tool integrations when configured
- Ollama-hosted LLM via CrewAI config

## Frontend Capabilities

- Displays article list from `GET /api/articles`
- Filters article feed by category on the client side
- Supports premium-style locked and unlocked article behavior
- Stores subscription status in `localStorage`
- Allows manual article submission from the UI to `POST /api/articles`
- Includes a cleanup button for removing agent/test data through `DELETE /api/articles/clear-test-data`

Main frontend entry points:

- [frontend/app/page.tsx](/Users/linyuanyuan/guavanews/frontend/app/page.tsx)
- [frontend/app/article/[id]/page.tsx](/Users/linyuanyuan/guavanews/frontend/app/article/[id]/page.tsx)
- [frontend/app/providers.tsx](/Users/linyuanyuan/guavanews/frontend/app/providers.tsx)

## Backend Capabilities

- Accepts agent-generated or manually submitted articles through a unified `POST /api/articles`
- Returns all stored articles through `GET /api/articles`
- Removes test or noisy content through `DELETE /api/articles/clear-test-data`
- Persists articles into the `news_posts` table
- Runs an editorial workflow where:
  - `scout_agent` gathers source material
  - `neon_agent` or `cipher_agent` writes the article
  - `publisher_agent` posts the result back into the API

Main backend entry points:

- [backend/main.py](/Users/linyuanyuan/guavanews/backend/main.py)
- [backend/agents/scout.py](/Users/linyuanyuan/guavanews/backend/agents/scout.py)
- [backend/agents/writer.py](/Users/linyuanyuan/guavanews/backend/agents/writer.py)
- [backend/agents/publisher.py](/Users/linyuanyuan/guavanews/backend/agents/publisher.py)
- [backend/tasks/news_tasks.py](/Users/linyuanyuan/guavanews/backend/tasks/news_tasks.py)
- [backend/core/database.py](/Users/linyuanyuan/guavanews/backend/core/database.py)

## API Overview

### `POST /api/articles`

Accepts:

- a single object
- or a list of article objects

Recognized fields include:

- `title`
- `content` or `body`
- `category`
- `author`
- `language`

### `GET /api/articles`

Returns all articles ordered by descending `id`.

### `DELETE /api/articles/clear-test-data`

Removes:

- articles written by `AGENT_NEON`
- titles containing `poisonedRag`
- articles in category `Network Noise`

## Local Development

### 1. Start the frontend

```bash
cd /Users/linyuanyuan/guavanews/frontend
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:3000
```

### 2. Start the backend API

```bash
cd /Users/linyuanyuan/guavanews/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Backend default URL:

```text
http://127.0.0.1:8000
```

### 3. Run the editorial agent pipeline

```bash
cd /Users/linyuanyuan/guavanews/backend
source .venv/bin/activate
python3 go.py
```

This runs `start_guava_editorial()` and lets the CrewAI workflow generate and publish articles into the backend.

## Environment and Services

The backend currently expects:

- PostgreSQL running locally at `postgresql://linyuanyuan@localhost:5432/guava_db`
- or a Supabase Postgres connection string via `DATABASE_URL`
- Ollama available at `http://localhost:11434`
- optional API keys in [backend/.env](/Users/linyuanyuan/guavanews/backend/.env)

Example `DATABASE_URL` for Supabase:

```env
DATABASE_URL=postgresql://username:password@db.your-project.supabase.co:5432/postgres
```

Useful backend config files:

- [backend/core/config.py](/Users/linyuanyuan/guavanews/backend/core/config.py)
- [backend/.env](/Users/linyuanyuan/guavanews/backend/.env)

## Notes

- The frontend currently calls the backend directly at `http://127.0.0.1:8000`
- The wallet subscription flow is a local prototype and uses a hard-coded recipient address
- The AI newsroom is designed for experimentation and still depends on local model and tool availability
- Some integrations such as Composio and Ollama require valid local setup before the full pipeline can run reliably
