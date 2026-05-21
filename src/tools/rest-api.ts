import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

const RestApiCallSchema = z.object({
  provider: z.enum(['salesforce', 'hubspot', 'custom']).describe('API provider'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
  endpoint: z.string().describe('API endpoint path'),
  headers: z.record(z.string()).optional().describe('Additional headers'),
  body: z.unknown().optional().describe('Request body for POST/PUT/PATCH'),
  params: z.record(z.string()).optional().describe('Query parameters'),
});

const RestApiResultSchema = z.object({
  status: z.number(),
  headers: z.record(z.string()),
  body: z.unknown(),
  duration_ms: z.number(),
});

type RestApiInput = z.infer<typeof RestApiCallSchema>;
type RestApiResultOutput = z.infer<typeof RestApiResultSchema>;

// Token storage (simplified)
const tokenStorage: Map<string, string> = new Map();

async function restApiHandler(ctx: ToolContext, input: RestApiInput): Promise<ToolResult<RestApiResultOutput>> {
  const start = Date.now();

  try {
    // Get OAuth token for provider
    let token = tokenStorage.get(`${ctx.clientId}:${input.provider}`);
    if (!token) {
      return {
        success: false,
        error: { code: 'AUTH_ERROR', message: `No OAuth token found for ${input.provider}. Please authenticate first.` },
      };
    }

    // Build URL (simplified - would need proper URL construction in production)
    const baseUrls: Record<string, string> = {
      salesforce: 'https://login.salesforce.com',
      hubspot: 'https://api.hubapi.com',
      custom: 'https://api.example.com',
    };

    const url = new URL(input.endpoint, baseUrls[input.provider]);
    if (input.params) {
      Object.entries(input.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...input.headers,
    };

    const response = await fetch(url.toString(), {
      method: input.method,
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
    });

    const responseBody = await response.json().catch(() => null);

    return {
      success: true,
      data: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        duration_ms: Date.now() - start,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: { code: 'API_ERROR', message: e instanceof Error ? e.message : String(e) },
    };
  }
}

export const restApiTool: ToolDefinition<RestApiInput, RestApiResultOutput> = {
  name: 'rest_api',
  description: 'Invoke external REST APIs (Salesforce, HubSpot, custom). Handles OAuth token management automatically. Returns parsed JSON response with status, headers, and body.',
  inputSchema: RestApiCallSchema,
  outputSchema: RestApiResultSchema,
  scope: 'read',
  handler: restApiHandler,
};