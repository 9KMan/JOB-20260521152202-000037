import { z } from 'zod';
import type { ToolDefinition, ToolHandler, ToolContext, ToolResult, ToolScope, RateLimitConfig } from './types.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    // Validate the schema by attempting to parse
    try {
      tool.inputSchema.parse({});
      tool.outputSchema.parse({});
    } catch (e) {
      throw new Error(`Invalid schema for tool '${tool.name}': ${e}`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listTools(): { name: string; description: string; inputSchema: object }[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema instanceof z.ZodSchema
        ? tool.inputSchema.schema
        : tool.inputSchema,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute<TInput, TOutput>(
    name: string,
    ctx: ToolContext,
    input: unknown
  ): Promise<ToolResult<TOutput>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${name}' not found` },
      };
    }

    const start = Date.now();
    try {
      // Validate input against schema
      const validatedInput = tool.inputSchema.parse(input);
      const result = await tool.handler(ctx, validatedInput);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration_ms: Date.now() - start,
          tool_name: name,
          requester: ctx.requester,
        },
      };
    } catch (e) {
      if (e instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid input: ${e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')}`,
            details: e.errors,
          },
          metadata: {
            duration_ms: Date.now() - start,
            tool_name: name,
            requester: ctx.requester,
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: e instanceof Error ? e.message : String(e),
        },
        metadata: {
          duration_ms: Date.now() - start,
          tool_name: name,
          requester: ctx.requester,
        },
      };
    }
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();