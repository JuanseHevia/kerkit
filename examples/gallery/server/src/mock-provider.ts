import type { GenerateOptions, ProviderAdapter, ProviderTurn } from '@kerkit/ai';

/**
 * A scripted "model" so the gallery runs with no API key: on the first round
 * it calls a kerkit tool chosen from the user's message; on the second it
 * answers in es-AR referencing the tool output. Deterministic on purpose —
 * the demo shows the SDK's plumbing (loop, tools, redaction), not an LLM.
 *
 * Set OPENAI_API_KEY to swap this for the real OpenAI Responses adapter
 * (see provider.ts); the loop, tools, and redaction are identical either way.
 */
export class MockProvider implements ProviderAdapter {
  async generate(opts: GenerateOptions): Promise<ProviderTurn> {
    const isContinuation = Boolean(opts.state);

    if (isContinuation) {
      const output = opts.toolResults?.[0]?.output ?? '';
      const toolName = opts.toolResults?.[0]?.name ?? 'la consulta';
      const lines = output.split('\n').length;
      return {
        text: `(demo) Consulté ${toolName} y encontré información (${lines} líneas). En una app real, acá el modelo redactaría una respuesta cálida y concreta con el próximo paso. Fijate que ningún identificador real llegó hasta acá: los datos vienen redactados.`,
        toolCalls: [],
        state: null,
      };
    }

    const message = opts.input[opts.input.length - 1]?.content.toLowerCase() ?? '';
    const tool =
      message.includes('trámite') || message.includes('autoriza')
        ? 'read_authorizations'
        : message.includes('receta') || message.includes('medicac')
          ? 'read_prescriptions'
          : message.includes('nota')
            ? 'read_notes'
            : 'read_appointments';

    if (!opts.tools?.some((t) => t.name === tool)) {
      return {
        text: '(demo) Hola — preguntame por turnos, trámites, recetas o notas.',
        toolCalls: [],
        state: null,
      };
    }

    return {
      text: null,
      toolCalls: [{ id: 'demo-call-1', name: tool, arguments: {} }],
      state: { round: 1 },
    };
  }
}
