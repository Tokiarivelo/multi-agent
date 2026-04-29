# Multi-Agent Platform

> **Production-ready AI workflow orchestration platform with multi-LLM support, event-driven architecture, and comprehensive security**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.3-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development](#development)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## 🌟 Overview

Multi-Agent Platform is an enterprise-grade AI orchestration system that enables complex workflow automation through:

- **Multi-LLM Support**: Seamlessly integrate OpenAI, Anthropic, Google, Azure, and Ollama models
- **Workflow Orchestration**: Build and execute complex DAG-based workflows with real-time monitoring
- **Event-Driven Architecture**: NATS-powered microservices for scalability and resilience
- **Secure Credential Management**: AES-256 encrypted API key storage with user-level isolation
- **Vector Search**: Semantic search capabilities powered by Qdrant
- **Sandboxed Execution**: Secure tool execution environment using isolated VMs

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (Next.js)                          │
│                         Port 3001 - User UI                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP/WebSocket
┌────────────────────────────────▼────────────────────────────────────┐
│                     Gateway Service (Go/Axum)                        │
│               Port 3000 - Reverse Proxy + JWT Auth                   │
└──┬────────┬────────┬────────┬────────┬────────┬────────┬────────────┘
   │        │        │        │        │        │        │
┌──▼───┐ ┌─▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌─▼───┐ ┌──▼───┐
│Agent │ │Orch.│ │Exec. │ │Model │ │Tool  │ │Vector│ │Doc.  │
│:3002 │ │:3003│ │:3004 │ │:3005 │ │:3030 │ │:3007 │ │:3009 │
│NestJS│ │NestJS│ │NestJS│ │NestJS│ │ Rust │ │NestJS│ │Python│
└──┬───┘ └──┬──┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──────┘
   │        │        │        │        │        │
   └────────┴────────┴────────┴────────┴────────┘
                     │
        ┌────────────┴────────────┐
        │    NATS JetStream       │
        │   Event Bus (Pub/Sub)   │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │  PostgreSQL + Qdrant    │
        │   Data & Vector Store   │
        └─────────────────────────┘
```

### Service Overview

| Service              | Port | Lang    | Purpose                                           |
| -------------------- | ---- | ------- | ------------------------------------------------- |
| **Gateway**          | 3000 | Go      | Reverse proxy, JWT auth, rate-limiting            |
| **Frontend**         | 3001 | Next.js | Web interface                                     |
| **Agent**            | 3002 | NestJS  | AI agent management & LangChain execution         |
| **Orchestration**    | 3003 | NestJS  | Workflow orchestration engine                     |
| **Execution**        | 3004 | NestJS  | Execution tracking & audit logs                   |
| **Model**            | 3005 | NestJS  | LLM provider management & API key encryption      |
| **Tool Sandbox**     | 3030 | Rust    | Tool registry, QuickJS sandbox, MCP proxy         |
| **Vector**           | 3007 | NestJS  | Vector storage & semantic search                  |
| **Document**         | 3009 | Python  | PDF parsing, image OCR, document generation       |

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

## ✨ Features

### Core Capabilities

- ✅ **Multi-LLM Integration**
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude 3.5, Claude 3)
  - Google (Gemini Pro, Gemini Flash)
  - Azure OpenAI
  - Ollama (self-hosted models)

- ✅ **Workflow Orchestration**
  - Visual DAG-based workflow builder
  - Node-based execution graph
  - Real-time execution monitoring via WebSocket
  - Conditional branching and parallel execution
  - Error handling and retry logic

- ✅ **AI Agent Management**
  - Custom system prompts
  - Tool binding and configuration
  - Token streaming for responsive UI
  - Execution history and logs
  - Multi-provider model selection

- ✅ **Tool Ecosystem**
  - Web scraping (Rust scraper crate)
  - HTTP API calls with configurable domain allowlist
  - File and shell operations (workspace-sandboxed)
  - Custom JavaScript execution (QuickJS, per-invocation isolation)
  - MCP tool proxy (GitHub, Trello, custom)
  - Rate limiting and security controls

- ✅ **Vector Search**
  - Semantic document search
  - Collection management per user
  - Configurable dimensions
  - Similarity scoring

### Security Features

- 🔐 **Authentication**: JWT-based with Passport strategy
- 🔐 **Authorization**: Role-based access control (ADMIN, USER, VIEWER)
- 🔐 **API Key Encryption**: AES-256-GCM encryption with per-user keys
- 🔐 **Sandboxed Execution**: QuickJS (via Rust/rquickjs) — isolated JS runtime per invocation with hard CPU + wall-clock timeouts
- 🔐 **Rate Limiting**: Per-service request throttling
- 🔐 **CORS**: Configurable cross-origin resource sharing

For detailed security documentation, see [SECURITY.md](SECURITY.md).

## 🛠️ Technology Stack

### Backend

- **Framework**: NestJS 10.3 (TypeScript microservices)
- **Gateway**: Go 1.22+ with net/http + gorilla/mux (high-throughput reverse proxy)
- **Tool Sandbox**: Rust 1.85+ with Axum 0.7 + QuickJS (isolated JS execution)
- **Runtime**: Node.js 24+
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL 16 with Prisma ORM
- **Messaging**: NATS 2.10 with JetStream
- **Vector DB**: Qdrant
- **AI/ML**: LangChain, OpenAI SDK, Anthropic SDK

### Frontend

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query v5
- **Forms**: React Hook Form + Zod validation

### DevOps

- **Container**: Docker & Docker Compose
- **Orchestration**: Kubernetes (Skaffold)
- **Package Manager**: pnpm 8+
- **Testing**: Jest + ts-jest
- **Linting**: ESLint + Prettier
- **Git Hooks**: Husky

## 📁 Project Structure

```
multi-agent/
├── services/                    # Microservices
│   ├── gateway-service/        # API gateway + authentication
│   ├── agent-service/          # AI agent management
│   ├── orchestration-service/  # Workflow orchestration
│   ├── execution-service/      # Execution tracking
│   ├── model-service/          # LLM provider management
│   ├── tool-service/           # Tool registry & execution
│   └── vector-service/         # Vector storage & search
├── packages/                    # Shared packages
│   ├── common/                 # Shared utilities
│   ├── database/               # Shared Prisma client & schema
│   │   ├── prisma/             # Database schema & migrations
│   │   ├── src/                # PrismaService & re-exports
│   │   └── prisma.config.ts    # Prisma configuration
│   ├── types/                  # TypeScript type definitions
│   ├── events/                 # Event schemas
│   └── nats-client/            # NATS messaging client
├── frontend/                    # Next.js web application
├── k8s/                         # Kubernetes manifests
├── docker-compose.yml          # Local development stack
├── skaffold.yaml               # Kubernetes deployment
└── Makefile                    # Development commands
```

## 📋 Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: >= 8.0.0
- **Go**: >= 1.22 (for gateway-service-go)
- **Rust**: >= 1.85 (for tool-sandbox-rs)
- **Docker**: >= 24.0.0
- **Docker Compose**: >= 2.0.0
- **Kubernetes** (optional): minikube or Docker Desktop
- **kubectl** (optional): for Kubernetes deployment

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/multi-agent.git
cd multi-agent
```

### 2. Install Dependencies

```bash
make install
```
*(This installs Node, Python, and Go dependencies for all services)*

### 3. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Infrastructure Services

```bash
docker-compose up -d
```

This starts:

- NATS (port 4222)
- PostgreSQL (port 5432)
- Qdrant (port 6333)

### 5. Run Database Migrations

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate
```

### 6. Start Development Servers

```bash
pnpm dev
```

This starts all services in development mode with hot-reload (including Python and Go services):

- Gateway (Go): http://localhost:3000
- Frontend: http://localhost:3001
- Agent Service: http://localhost:3002
- Orchestration Service: http://localhost:3003
- Execution Service: http://localhost:3004
- Model Service: http://localhost:3005
- Tool Sandbox (Rust): http://localhost:3030 · Swagger UI: http://localhost:3030/docs/
- Vector Service: http://localhost:3007
- Document Service (Python): http://localhost:3009

### 7. Access the Application

Open your browser and navigate to:

- **Frontend**: http://localhost:3001
- **API Gateway**: http://localhost:3000
- **API Gateway (Go Migration)**: http://localhost:3020
- **API Documentation**: http://localhost:3000/api (Swagger)

## 💻 Development

For detailed development guide, see [DEVELOPMENT.md](DEVELOPMENT.md).

### Quick Commands

```bash
# Install all dependencies (Node, Python, Go)
make install

# Run all services in development mode
pnpm dev

# Build all TS services
pnpm build

# Run tests
pnpm test

# Lint all code
pnpm lint

# Format code
pnpm format
```

## 🚢 Deployment

For detailed deployment guide, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Local Docker Deployment

```bash
docker-compose up --build -d
```

### Kubernetes Deployment

```bash
# Using Makefile
make cluster-start
make deploy
make status

# Or manually
minikube start
skaffold dev
```

## 📚 API Documentation

For detailed API documentation, see [API.md](API.md).

### Swagger Documentation

Once the gateway service is running, access interactive API documentation at:

- **Local**: http://localhost:3000/api
- **Kubernetes**: http://<your-cluster-ip>:3000/api

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests**: `pnpm test`
5. **Run linting**: `pnpm lint`
6. **Commit your changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Commit Message Convention

```
type(scope): subject

Examples:
feat(agent): add streaming support
fix(gateway): resolve auth token expiration
docs(readme): update installation instructions
```

## 📄 License

This project is licensed under the MIT License.

```
MIT License

Copyright (c) 2024 Multi-Agent Platform

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/multi-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/multi-agent/discussions)

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Next.js](https://nextjs.org/) - React framework
- [LangChain](https://langchain.com/) - LLM application framework
- [NATS](https://nats.io/) - Cloud-native messaging system
- [Qdrant](https://qdrant.tech/) - Vector similarity search engine
- [Prisma](https://www.prisma.io/) - Next-generation ORM

---

**Built with ❤️ by the Multi-Agent Platform Team**
