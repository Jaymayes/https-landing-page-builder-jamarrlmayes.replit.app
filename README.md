# AI Venture Studio - Floating AI Salesperson

A **Living Proof-of-Concept** landing page featuring a Floating Digital Human that acts as an AI-powered SDR (Sales Development Representative) for Referral Service LLC.

## The "Why"

This is not just a website - it's a demonstration of conversational AI in action. The floating avatar uses:
- **HeyGen Streaming Avatar** for realistic, low-latency digital human interactions
- **OpenAI GPT-4o with Function Calling** to qualify leads and schedule meetings
- **Real-time voice transcription** for natural conversations

## Features

- Floating AI avatar widget that greets visitors
- Voice and text input support
- Lead qualification via OpenAI Function Calling:
  - `qualify_lead` - Captures name, company, email, pain point
  - `check_availability` - Schedules consultations
- Conversation history stored in PostgreSQL
- Responsive design with dark/light mode

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| UI | shadcn/ui (Radix) + Tailwind CSS + Framer Motion |
| State | Zustand + TanStack Query |
| Backend | Express 5 (Node.js) |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI GPT-4o + Whisper |
| Avatar | HeyGen Streaming SDK |

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or cloud like Neon/Supabase)
- OpenAI API key
- HeyGen API key

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Jaymayes/https-landing-page-builder-jamarrlmayes.replit.app.git
cd https-landing-page-builder-jamarrlmayes.replit.app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# OpenAI API Key
# Get yours at: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# HeyGen API Key
# Get yours at: https://app.heygen.com/settings?nav=API
HEYGEN_API_KEY=...

# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/referral_service

# App config
PORT=5000
NODE_ENV=development
```

### 4. Set up the database

```bash
npm run db:push
```

### 5. Run development server

```bash
npm run dev
```

Visit `http://localhost:5000`

## Getting API Keys

### HeyGen Trial Token

1. Sign up at [HeyGen](https://app.heygen.com)
2. Go to Settings > API
3. Generate an API key
4. Note: Trial accounts have limited streaming minutes

### OpenAI Keys

1. Sign up at [OpenAI Platform](https://platform.openai.com)
2. Go to API Keys
3. Create a new secret key
4. Required models: `gpt-4o`, `gpt-4o-mini-transcribe`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ AvatarWidget│  │ Voice Input │  │ HeyGen Streaming SDK│ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (API)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │/api/chat/:id│  │/api/transcr.│  │ /api/heygen/token   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         ▼                ▼                     │            │
│  ┌──────────────────────────────┐              │            │
│  │      OpenAI GPT-4o           │              │            │
│  │  (Function Calling + Chat)   │              │            │
│  └──────────────────────────────┘              │            │
│         │                                      │            │
│         ▼                                      ▼            │
│  ┌──────────────────┐               ┌──────────────────┐   │
│  │   PostgreSQL     │               │  HeyGen API      │   │
│  │  (Drizzle ORM)   │               │  (Token Gen)     │   │
│  └──────────────────┘               └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### WebSocket Connection Flow

1. User clicks the floating avatar widget
2. Client requests HeyGen streaming token from `/api/heygen/token`
3. HeyGen SDK establishes WebSocket connection to HeyGen servers
4. Avatar video stream is rendered in the widget
5. User speaks → Audio transcribed via Whisper → Chat sent to GPT-4o
6. GPT-4o may call functions (`qualify_lead`, `check_availability`)
7. Response text is sent to HeyGen for avatar speech synthesis

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push schema to database |

## Environment Support

This codebase supports both:
- **Localhost**: Uses standard `OPENAI_API_KEY` from `.env`
- **Replit**: Uses `AI_INTEGRATIONS_OPENAI_API_KEY` when available

The code automatically detects which environment it's running in.

## Critical TODOs

- [ ] Add `book_meeting` function to actually integrate with a calendar API (e.g., Calendly, Cal.com)
- [ ] Implement rate limiting on API endpoints
- [ ] Add authentication for the leads dashboard
- [ ] Set up webhook for lead notifications (email/Slack)

## License

MIT
