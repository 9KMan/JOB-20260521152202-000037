import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../src/tool-registry.js';
import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../src/types.js';

const TestInputSchema = z.object({
  name: z.string(),
  value: z.number(),
});

const TestOutputSchema = z.object({
  result: z.string(),
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register and retrieve a tool', () => {
    const tool: ToolDefinition = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: TestInputSchema,
      outputSchema: TestOutputSchema,
      scope: 'read',
      handler: async () => ({ success: true, data: { result: 'ok' } }),
    };

    registry.register(tool);
    expect(registry.has('test_tool')).toBe(true);
    expect(registry.get('test_tool')?.name).toBe('test_tool');
  });

  it('should throw when registering duplicate tool', () => {
    const tool: ToolDefinition = {
      name: 'dup_tool',
      description: 'A test tool',
      inputSchema: TestInputSchema,
      outputSchema: TestOutputSchema,
      scope: 'read',
      handler: async () => ({ success: true }),
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow("Tool 'dup_tool' is already registered");
  });

  it('should execute tool and return result', async () => {
    const tool: ToolDefinition = {
      name: 'exec_tool',
      description: 'An executable tool',
      inputSchema: TestInputSchema,
      outputSchema: TestOutputSchema,
      scope: 'read',
      handler: async (_ctx, input) => ({ success: true, data: { result: `Hello ${input.name}` } }),
    };

    registry.register(tool);

    const ctx: ToolContext = {
      requester: 'test-user',
      clientId: 'test-client',
      scopes: ['tools:read'],
      timestamp: new Date(),
    };

    const result = await registry.execute('exec_tool', ctx, { name: 'World', value: 42 });
    expect(result.success).toBe(true);
    expect((result as any).data?.result).toBe('Hello World');
  });

  it('should validate input against schema', async () => {
    const tool: ToolDefinition = {
      name: 'validate_tool',
      description: 'A validating tool',
      inputSchema: TestInputSchema,
      outputSchema: TestOutputSchema,
      scope: 'read',
      handler: async () => ({ success: true }),
    };

    registry.register(tool);

    const ctx: ToolContext = {
      requester: 'test-user',
      clientId: 'test-client',
      scopes: ['tools:read'],
      timestamp: new Date(),
    };

    // Missing required field 'name'
    const result = await registry.execute('validate_tool', ctx, { value: 42 });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('should list all registered tools', () => {
    registry.register({
      name: 'tool1',
      description: 'First tool',
      inputSchema: TestInputSchema,
      outputSchema: TestOutputSchema,
      scope: 'read',
      handler: async () => ({ success: true }),
    });

    registry.register({
      name: 'tool2',
      description: 'Second tool',
      inputSchema: TestInputSchema,
      outputSchema: TestOutputSchema,
      scope: 'write',
      handler: async () => ({ success: true }),
    });

    const tools = registry.listTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(t => t.name)).toContain('tool1');
    expect(tools.map(t => t.name)).toContain('tool2');
  });
});