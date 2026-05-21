import type { McpServer } from '@modelcontextprotocol/sdk/server/index.js';

interface HttpSseConfig {
  port: number;
  host: string;
}

export class HttpSseTransport {
  private server: McpServer;
  private config: HttpSseConfig;
  private clients: Set<(data: string) => void> = new Set();

  constructor(server: McpServer, config: HttpSseConfig) {
    this.server = server;
    this.config = config;
  }

  // Broadcast to all SSE clients
  broadcast(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client(message);
    }
  }

  // Create HTTP request handler
  createHandler() {
    return async (req: Request): Promise<Response> => {
      const url = new URL(req.url);

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-ID',
      };

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // POST /rpc - JSON-RPC endpoint
      if (url.pathname === '/rpc' && req.method === 'POST') {
        try {
          const body = await req.json();
          const result = await this.server.handleMessage(body);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (e) {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // GET /events - SSE stream
      if (url.pathname === '/events' && req.method === 'GET') {
        const clientId = req.headers.get('X-Client-ID') || 'anonymous';

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const send = (data: string) => controller.enqueue(encoder.encode(data));

            // Send initial connection event
            send(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`);

            // Store client callback
            const clientCallback = (message: string) => send(message);
            this?.clients?.add(clientCallback);

            // Keepalive
            const keepalive = setInterval(() => {
              send(`: keepalive\n\n`);
            }, 30000);

            // Cleanup on close
            req.signal.addEventListener('abort', () => {
              clearInterval(keepalive);
              this?.clients?.delete(clientCallback);
            });
          }.bind(this),
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders,
          },
        });
      }

      // GET /health - Health check
      if (url.pathname === '/health' && req.method === 'GET') {
        const startTime = Date.now();
        return new Response(JSON.stringify({
          status: 'healthy',
          transport: 'http-sse',
          activeConnections: this.clients.size,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /debug/tools - Debug endpoint (auth required in real impl)
      if (url.pathname === '/debug/tools' && req.method === 'GET') {
        const auth = req.headers.get('Authorization');
        if (!auth?.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const { toolRegistry } = await import('../tool-registry.js');
        return new Response(JSON.stringify({
          tools: toolRegistry.listTools(),
          count: toolRegistry.getAll().length,
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /.well-known/mcp - MCP manifest
      if (url.pathname === '/.well-known/mcp' && req.method === 'GET') {
        return new Response(JSON.stringify({
          name: process.env.MCP_SERVER_NAME || 'mcp-server-platform',
          version: process.env.MCP_SERVER_VERSION || '1.0.0',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true },
            prompts: {},
          },
          auth: {
            type: 'oauth2',
            issuer: 'https://auth.example.com',
            scopes: ['tools:read', 'tools:write', 'resources:read', 'resources:write'],
          },
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    };
  }
}