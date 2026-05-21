import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/index.js';

export class StdioTransport {
  private transport: StdioServerTransport | null = null;

  async connect(server: McpServer): Promise<void> {
    this.transport = new StdioServerTransport();

    // Handle stdin messages
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', async (chunk: string) => {
      try {
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.trim()) {
            const message = JSON.parse(line);
            // Handle message through MCP server
            await server.handleMessage(message);
          }
        }
      } catch (e) {
        console.error('Error parsing STDIN:', e);
      }
    });

    await server.connect(this.transport);
  }

  async close(): Promise<void> {
    if (this.transport) {
      // Drain in-flight requests
      await new Promise(resolve => setTimeout(resolve, 100));
      process.exit(0);
    }
  }
}