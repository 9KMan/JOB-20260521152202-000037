# MCP Server Integration Platform

TypeScript MCP server with dual-transport support (STDIO + HTTP/SSE), OAuth 2.1 + PKCE security, Zod schema validation, and OpenTelemetry observability.

## Architecture

```
MCP Client (Claude/GitHub Copilot)
         │
         ▼ JSON-RPC 2.0
┌─────────────────────────────────┐
│  MCP Server (Node.js/TypeScript) │
│  ┌───────────┬──────────┬────┐  │
│  │ Tool      │ Resource │Prompt│  │
│  │ Handler   │ Handler  │ Hub  │  │
│  └───────────┴────┬─────┴────┘  │
│  ┌────────────────┼────────────┐│
│  │ Security │ Rate Limit │Audit ││
│  └──────────┬───────┴───────┬──┘│
│             └───────┬───────┘    │
│  ┌──────────────────┼──────────┐│
│  │   Tool Registry (dynamic)   ││
│  └──────────────────┼──────────┘│
└──────────────────────┼────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    Database      REST APIs     File Store
      Tool          Tool          Tool
```

## Tech Stack

- **Runtime:** Node.js 20+, TypeScript (strict mode)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** Zod (schema-first, parse-at-boundary)
- **Auth:** OAuth 2.1 + PKCE, JWT access tokens
- **Observability:** OpenTelemetry (traces, metrics, logs)
- **Transport:** STDIO (local/CI) + HTTP/SSE (remote)
- **Testing:** Vitest

## Project Structure

```
src/
  index.ts              # Server entry point
  types.ts               # Shared type definitions
  tool-registry.ts       # Dynamic tool discovery + registration
  security/
    auth.ts             # OAuth 2.1 + PKCE middleware
    rate-limiter.ts     # Token-bucket rate limiting
    audit.ts           # Audit log for tool invocations
    prompt-injection.ts # LLM output sanitization
  transport/
    stdio.ts           # STDIO transport (local clients)
    http-sse.ts        # HTTP/SSE transport (remote clients)
  tools/
    database.ts       # Postgres/SQL tool
    rest-api.ts       # REST API invocation tool
    file-store.ts     # S3-compatible file operations
  observability/
    health.ts         # Health endpoint
    metrics.ts        # Prometheus-compatible metrics
    index.ts          # OpenTelemetry setup
tests/
  security.test.ts
  tool-registry.test.ts
  transport.test.ts
```

## Installation

```bash
npm install
```

## Configuration

```bash
cp .env.example .env
# Set MCP_SERVER_NAME, MCP_SERVER_VERSION, OAUTH_ISSUER_URL, etc.
```

## Running

```bash
# Development (STDIO transport)
npm run dev:stdio

# Production (HTTP/SSE transport)
npm start

# Run tests
npm test

# Run with MCP Inspector
npx @modelcontextprotocol/inspector npm run dev:stdio
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `npm run dev:stdio` | Start MCP server with STDIO transport |
| `npm start` | Start MCP server with HTTP/SSE transport |
| `npm test` | Run Vitest test suite |
| `npx @modelcontextprotocol/inspector` | Open MCP Inspector for local testing |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/rpc` | JSON-RPC 2.0 — tool invocation |
| `GET` | `/events` | SSE stream — server-initiated events |
| `GET` | `/health` | Health check |
| `GET` | `/debug/tools` | Registered tools + schemas |

## Security

- OAuth 2.1 + PKCE for all external clients
- Least-privilege scopes per tool: `tools:read`, `tools:write`
- All tool inputs validated via Zod before execution
- Rate limiting: sliding window per client_id
- Audit log: every invocation logged with requester, timestamp, args, result

## Quality Guarantees

- 100% Zod schema coverage for all tool inputs/outputs
- < 200ms p50 tool invocation latency
- < 1000ms p99 tool invocation latency
- Audit log completeness: 100% of invocations
- CI pipeline: 100% test pass rate