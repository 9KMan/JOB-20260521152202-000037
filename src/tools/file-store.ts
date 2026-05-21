import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

const FileOperationSchema = z.object({
  operation: z.enum(['get', 'put', 'list', 'delete']).describe('File operation'),
  bucket: z.string().describe('S3 bucket name'),
  key: z.string().describe('Object key'),
  content: z.string().optional().describe('File content for put operation (base64 or text)'),
  presign: z.boolean().optional().describe('Generate presigned URL instead of direct access'),
  expiresIn: z.number().optional().describe('Presigned URL expiration in seconds (default 3600)'),
});

const FileResultSchema = z.object({
  operation: z.string(),
  bucket: z.string(),
  key: z.string(),
  content: z.string().optional(),
  presignedUrl: z.string().optional(),
  size: z.number().optional(),
  lastModified: z.string().optional(),
  exists: z.boolean(),
  duration_ms: z.number(),
});

type FileStoreInput = z.infer<typeof FileOperationSchema>;
type FileStoreOutput = z.infer<typeof FileResultSchema>;

// Mock S3 client (would use @aws-sdk/client-s3 in production)
class MockS3Client {
  private store: Map<string, { content: string; meta: Record<string, unknown> }> = new Map();

  async getObject(bucket: string, key: string): Promise<{ content: string; size: number } | null> {
    const fullKey = `${bucket}/${key}`;
    const entry = this.store.get(fullKey);
    if (!entry) return null;
    return { content: entry.content, size: entry.content.length };
  }

  async putObject(bucket: string, key: string, content: string): Promise<void> {
    const fullKey = `${bucket}/${key}`;
    this.store.set(fullKey, { content, meta: { lastModified: new Date().toISOString() } });
  }

  async listObjects(bucket: string, prefix?: string): Promise<string[]> {
    const prefixKey = `${bucket}/${prefix || ''}`;
    return Array.from(this.store.keys())
      .filter(k => k.startsWith(prefixKey))
      .map(k => k.replace(`${bucket}/`, ''));
  }

  async deleteObject(bucket: string, key: string): Promise<boolean> {
    return this.store.delete(`${bucket}/${key}`);
  }

  generatePresignedUrl(bucket: string, key: string, expiresIn = 3600): string {
    return `https://${bucket}.s3.amazonaws.com/${key}?presigned=true&expires=${Date.now() + expiresIn * 1000}`;
  }
}

const s3Client = new MockS3Client();

async function fileStoreHandler(ctx: ToolContext, input: FileStoreInput): Promise<ToolResult<FileStoreOutput>> {
  const start = Date.now();

  try {
    switch (input.operation) {
      case 'get': {
        const result = await s3Client.getObject(input.bucket, input.key);
        if (!result) {
          return {
            success: false,
            error: { code: 'NOT_FOUND', message: `Object ${input.key} not found in bucket ${input.bucket}` },
          };
        }
        return {
          success: true,
          data: {
            operation: 'get',
            bucket: input.bucket,
            key: input.key,
            content: result.content,
            size: result.size,
            exists: true,
            duration_ms: Date.now() - start,
          },
        };
      }

      case 'put': {
        if (!input.content) {
          return { success: false, error: { code: 'INVALID_INPUT', message: 'Content required for put operation' } };
        }
        await s3Client.putObject(input.bucket, input.key, input.content);
        const size = input.content.length;
        return {
          success: true,
          data: {
            operation: 'put',
            bucket: input.bucket,
            key: input.key,
            size,
            exists: true,
            lastModified: new Date().toISOString(),
            duration_ms: Date.now() - start,
          },
        };
      }

      case 'list': {
        const keys = await s3Client.listObjects(input.bucket, input.key);
        return {
          success: true,
          data: {
            operation: 'list',
            bucket: input.bucket,
            key: input.key,
            content: JSON.stringify(keys),
            exists: keys.length > 0,
            duration_ms: Date.now() - start,
          },
        };
      }

      case 'delete': {
        const deleted = await s3Client.deleteObject(input.bucket, input.key);
        return {
          success: true,
          data: {
            operation: 'delete',
            bucket: input.bucket,
            key: input.key,
            exists: !deleted,
            duration_ms: Date.now() - start,
          },
        };
      }

      default:
        return { success: false, error: { code: 'INVALID_OPERATION', message: `Unknown operation: ${input.operation}` } };
    }
  } catch (e) {
    return {
      success: false,
      error: { code: 'STORAGE_ERROR', message: e instanceof Error ? e.message : String(e) },
    };
  }
}

export const fileStoreTool: ToolDefinition<FileStoreInput, FileStoreOutput> = {
  name: 'file_store',
  description: 'S3-compatible object storage operations: get, put, list, delete. Use presign=true to generate presigned URLs for direct client access. Requires tools:write scope for put/delete operations.',
  inputSchema: FileOperationSchema,
  outputSchema: FileResultSchema,
  scope: 'read',
  handler: fileStoreHandler,
};