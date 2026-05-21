import { z } from 'zod';

// Tool scopes
export const ToolScopeSchema = z.enum(['read', 'write', 'admin']);
export type ToolScope = z.infer<typeof ToolScopeSchema>;

// Rate limit config
export const RateLimitConfigSchema = z.object({
  requests: z.number().int().positive(),
  windowMs: z.number().int().positive(),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// Tool definition interface
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  scope: ToolScope;
  rateLimit?: RateLimitConfig;
  handler: ToolHandler<TInput, TOutput>;
}

// Tool handler pattern
export interface ToolContext {
  requester: string;
  clientId?: string;
  scopes: string[];
  timestamp: Date;
}

export type ToolHandler<TInput, TOutput> = (
  ctx: ToolContext,
  input: TInput
) => Promise<ToolResult<TOutput>>;

// Tool result
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    duration_ms: number;
    tool_name: string;
    requester: string;
  };
}

// Audit entry
export interface AuditEntry {
  id: string;
  timestamp: string;
  requester: string;
  tool_name: string;
  args: unknown;
  result: 'success' | 'error';
  error_code?: string;
  duration_ms: number;
  ip_address?: string;
}

// Transport types
export type TransportType = 'stdio' | 'http-sse';

// Server config
export interface ServerConfig {
  name: string;
  version: string;
  transport: TransportType;
  port?: number;
  host?: string;
}