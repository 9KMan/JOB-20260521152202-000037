#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpServerTransport } from '@modelcontextprotocol/sdk/server/http.js';
import { toolRegistry } from './tool-registry.js';
import { AuditLogger } from './security/audit.js';
import { RateLimiter } from './security/rate-limiter.js';
import { AuthMiddleware } from './security/auth.js';
import { ServerConfig } from './types.js';
import { setupObservability } from './observability/index.js';

class MCPServerPlatform {
  private server: McpServer;
  private config: ServerConfig;
  private auditLogger: AuditLogger;
  private rateLimiter: RateLimiter;
  private authMiddleware: AuthMiddleware;

  constructor(config: ServerConfig) {
    this.config = config;
    this.auditLogger = new AuditLogger();
    this.rateLimiter = new RateLimiter();
    this.authMiddleware = new AuthMiddleware();

    this.server = new McpServer({
      name: config.name,
      version: config.version,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tools list handler
    this.server.setRequestHandler({ method: 'tools/list' }, async () => {
      return { tools: toolRegistry.listTools() };
    });

    // Tool call handler
    this.server.setRequestHandler({ method: 'tools/call' }, async (request: any) => {
      const { name, arguments: args } = request.params;
      const start = Date.now();

      // Rate limit check
      const clientId = request.headers?.['x-client-id'] || 'anonymous';
      if (!this.rateLimiter.check(clientId, name)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' },
              metadata: { duration_ms: Date.now() - start, tool_name: name, requester: clientId },
            }),
          }],
        };
      }

      const ctx = {
        requester: clientId,
        clientId,
        scopes: this.authMiddleware.getScopes(clientId),
        timestamp: new Date(),
      };

      const result = await toolRegistry.execute(name, ctx, args);

      // Audit log
      this.auditLogger.log({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        requester: clientId,
        tool_name: name,
        args,
        result: result.success ? 'success' : 'error',
        error_code: result.error?.code,
        duration_ms: result.metadata?.duration_ms ?? Date.now() - start,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    });
  }

  async start(): Promise<void> {
    setupObservability(this.config);

    if (this.config.transport === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } else {
      const transport = new HttpServerTransport({
        port: this.config.port ?? 3000,
        host: this.config.host ?? '0.0.0.0',
      });
      await this.server.connect(transport);
    }

    console.error(`MCP Server started: ${this.config.name} v${this.config.version}`);
  }
}

// CLI entry
const config: ServerConfig = {
  name: process.env.MCP_SERVER_NAME ?? 'mcp-server-platform',
  version: process.env.MCP_SERVER_VERSION ?? '1.0.0',
  transport: (process.env.MCP_TRANSPORT as TransportType) ?? 'stdio',
  port: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : undefined,
  host: process.env.MCP_HOST,
};

const server = new MCPServerPlatform(config);
server.start().catch(console.error);