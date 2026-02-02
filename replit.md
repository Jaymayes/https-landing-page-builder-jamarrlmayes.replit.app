# AI Venture Studio Landing Page

## Overview
A production-ready landing page for Referral Service LLC, an AI Venture Studio. Features a floating AI salesperson avatar widget powered by HeyGen Streaming Avatar SDK and OpenAI GPT-4o for lead qualification.

## Current State
- **Status**: MVP Complete
- **Last Updated**: 2026-02-02

## Tech Stack
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Framer Motion
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (Drizzle ORM)
- **AI/Avatar**: HeyGen Streaming Avatar SDK, OpenAI GPT-4o
- **State Management**: Zustand

## Project Architecture

### Directory Structure
```
client/
├── src/
│   ├── components/         # React components
│   │   ├── ui/             # Shadcn UI components
│   │   ├── Header.tsx
│   │   ├── HeroSection.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── TrustSection.tsx
│   │   ├── Footer.tsx
│   │   ├── AvatarWidget.tsx  # Floating AI avatar
│   │   └── ThemeProvider.tsx
│   ├── pages/
│   │   └── LandingPage.tsx
│   ├── store/
│   │   └── avatarStore.ts    # Zustand state
│   └── lib/
│       └── queryClient.ts
├── replit_integrations/
│   └── audio/               # Audio utilities for voice chat
└── public/
    └── audio-playback-worklet.js

server/
├── routes.ts                # API endpoints
├── storage.ts               # Database operations
├── db.ts                    # Drizzle connection
└── replit_integrations/
    └── audio/               # Audio processing

shared/
└── schema.ts                # Database schema
```

### Key Features
1. **Landing Page**
   - Modern B2B aesthetic with gradient theme
   - Hero section with animated headline
   - Services cards (6 service offerings)
   - Trust signals (stats, testimonials)
   - Responsive footer

2. **Floating Avatar Widget**
   - Collapsed state: Circular button in bottom-right corner
   - Expanded state: Side panel with video avatar
   - Voice input via microphone
   - Text input alternative
   - HeyGen streaming avatar with lip-sync

3. **AI Conversation**
   - OpenAI GPT-4o for conversation intelligence
   - Function calling for lead qualification
   - `qualify_lead()` - Captures lead details
   - `check_availability()` - Returns mock calendar slots

### API Endpoints
- `POST /api/heygen/token` - Generate HeyGen session token
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation with messages
- `POST /api/chat/:conversationId` - Send message and get AI response
- `POST /api/transcribe` - Transcribe audio to text
- `GET /api/leads` - Get all qualified leads

### Database Schema
- `users` - User authentication
- `conversations` - Chat sessions
- `messages` - Conversation messages
- `leads` - Qualified lead information

### Environment Variables
- `HEYGEN_API_KEY` - HeyGen API key for avatar streaming
- `SESSION_SECRET` - Session encryption key
- `DATABASE_URL` - PostgreSQL connection string
- `AI_INTEGRATIONS_*` - Replit AI Integration keys (auto-configured)

## Development

### Running Locally
```bash
npm run dev
```

### Database Commands
```bash
npm run db:push  # Push schema changes
```

## Design System
- **Primary Color**: Purple (250° hue)
- **Accent Color**: Teal (174° hue)
- **Font**: Inter, Plus Jakarta Sans
- **Dark/Light Mode**: Supported via ThemeProvider

## User Preferences
- Modern, clean B2B aesthetic
- Gradient text for emphasis
- Animations via Framer Motion
- Low-latency avatar responses prioritized
