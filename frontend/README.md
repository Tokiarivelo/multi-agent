# Multi-Agent Platform - Frontend

A modern Next.js 14+ frontend application for the Multi-Agent Platform, built with TypeScript, React Query, Zustand, and Tailwind CSS.

## Features

- **Authentication**: JWT-based login and registration
- **Workflows**: Create, edit, and visualize multi-agent workflows
- **Agents**: Configure AI agents with custom prompts and tools
- **Tools**: Browse available tools for agents
- **Models**: View and manage language models
- **Executions**: Monitor workflow executions with real-time logs
- **Token Streaming**: Real-time LLM token streaming via WebSocket
- **Responsive Design**: Mobile-friendly UI with dark mode support

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Validation**: Zod
- **Forms**: React Hook Form
- **Real-time**: WebSocket client for NATS

## Getting Started

### Installation

```bash
npm install
cp .env.example .env.local
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t multi-agent-frontend .
docker run -p 3001:3001 multi-agent-frontend
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Gateway service URL (default: http://localhost:3000)
- `NEXT_PUBLIC_WS_URL` - WebSocket URL (default: ws://localhost:3000)
