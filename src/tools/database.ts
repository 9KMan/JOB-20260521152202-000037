import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

// For demo, using a mock - in production would use pg or @supabase/supabase-js
const DatabaseQuerySchema = z.object({
  sql: z.string().describe('SQL query to execute'),
  params: z.array(z.unknown()).optional().describe('Query parameters'),
});

const DatabaseResultSchema = z.object({
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number(),
  duration_ms: z.number(),
});

type DatabaseInput = z.infer<typeof DatabaseQuerySchema>;
type DatabaseOutput = z.infer<typeof DatabaseResultSchema>;

// Mock database client
class MockDatabaseClient {
  async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 50));

    // Return mock data for demo
    if (sql.toLowerCase().includes('select')) {
      return {
        rows: [
          { id: 1, name: 'Demo User', email: 'demo@example.com', created_at: new Date().toISOString() },
          { id: 2, name: 'Test User', email: 'test@example.com', created_at: new Date().toISOString() },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  }
}

const dbClient = new MockDatabaseClient();

async function dbQueryHandler(ctx: ToolContext, input: DatabaseInput): Promise<ToolResult<DatabaseOutput>> {
  const start = Date.now();

  try {
    // Check write permissions for non-SELECT queries
    if (!input.sql.toLowerCase().startsWith('select') && !ctx.scopes.includes('tools:write')) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Write scope required for this operation' },
      };
    }

    const result = await dbClient.query(input.sql, input.params);
    return {
      success: true,
      data: {
        rows: result.rows as DatabaseOutput['rows'],
        rowCount: result.rowCount,
        duration_ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: { code: 'DB_ERROR', message: e instanceof Error ? e.message : String(e) },
    };
  }
}

export const databaseTool: ToolDefinition<DatabaseInput, DatabaseOutput> = {
  name: 'db_query',
  description: 'Execute a SQL query against the connected database. Use SELECT queries for read operations. Requires tools:write scope for INSERT/UPDATE/DELETE.',
  inputSchema: DatabaseQuerySchema,
  outputSchema: DatabaseResultSchema,
  scope: 'read',
  handler: dbQueryHandler,
};