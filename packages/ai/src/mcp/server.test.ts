import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RedactionSession } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import { registerKerkitTools, type McpServerLike } from './server.js';
import type { ToolDefinition, ToolResult } from './types.js';

describe('registerKerkitTools redaction sidecar', () => {
  it('requires a session factory, sweeps MCP content, and reports tokens app-side', async () => {
    let registered: ((params: Record<string, unknown>) => Promise<ToolResult>) | undefined;
    const server: McpServerLike = {
      registerTool(_name, _config, handler) {
        registered = handler;
      },
    };
    const tool: ToolDefinition = {
      name: 'read_demo',
      description: 'Synthetic test tool',
      inputSchema: z.object({}),
      handler: async () => ({
        content: [{ type: 'text', text: 'Nota de Marta Pérez' }],
        structuredContent: { patient: 'Marta Pérez' },
      }),
    };
    const sidecar = vi.fn();

    registerKerkitTools(server, [tool], {
      repos: {} as never,
      pack: argentina,
      userMode: { kind: 'static', userId: 'synthetic-user' },
      createSession: () =>
        new RedactionSession({
          patterns: argentina.identifierPatterns,
          seedTokens: new Map([['«PATIENT_NAME_1»', 'Marta Pérez']]),
        }),
      onRedaction: sidecar,
    });

    const result = await registered!({});
    expect(result.content[0].text).toBe('Nota de «PATIENT_NAME_1»');
    expect(result.structuredContent).toEqual({ patient: '«PATIENT_NAME_1»' });
    expect(sidecar).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'synthetic-user',
        toolName: 'read_demo',
        tokens: expect.any(Map),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('Marta Pérez');
  });

  it('sweeps thrown tool errors before returning them to the MCP model path', async () => {
    let registered: ((params: Record<string, unknown>) => Promise<ToolResult>) | undefined;
    const server: McpServerLike = {
      registerTool(_name, _config, handler) {
        registered = handler;
      },
    };
    const session = new RedactionSession({
      seedTokens: new Map([['«PATIENT_NAME_1»', 'Paciente Secreto']]),
    });
    const tool: ToolDefinition = {
      name: 'throws',
      description: 'Synthetic throwing tool',
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error('Paciente Secreto no disponible');
      },
    };

    registerKerkitTools(server, [tool], {
      repos: {} as never,
      pack: argentina,
      userMode: { kind: 'static', userId: 'synthetic-user' },
      createSession: () => session,
    });

    const result = await registered!({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('«PATIENT_NAME_1»');
    expect(result.content[0].text).not.toContain('Paciente Secreto');
  });
});
