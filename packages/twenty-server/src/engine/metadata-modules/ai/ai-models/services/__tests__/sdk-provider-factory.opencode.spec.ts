import { generateText } from 'ai';
import { SdkProviderFactoryService } from 'src/engine/metadata-modules/ai/ai-models/services/sdk-provider-factory.service';

describe('custom gateway API protocols', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    {
      npm: '@ai-sdk/openai-compatible' as const,
      path: '/chat/completions',
      response: {
        id: 'chat-test',
        object: 'chat.completion',
        created: 1,
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    },
    {
      npm: '@ai-sdk/openai' as const,
      path: '/responses',
      response: {
        id: 'resp-test',
        object: 'response',
        created_at: 1,
        model: 'test-model',
        status: 'completed',
        output: [
          {
            id: 'msg-test',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'Hello', annotations: [] }],
          },
        ],
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      },
    },
    {
      npm: '@ai-sdk/anthropic' as const,
      path: '/messages',
      response: {
        id: 'msg-test',
        type: 'message',
        role: 'assistant',
        model: 'test-model',
        content: [{ type: 'text', text: 'Hello' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    },
  ])(
    'sends $npm requests to the configured gateway $path',
    async ({ npm, path, response }) => {
      const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const provider = new SdkProviderFactoryService().createProvider(
        'opencode',
        {
          npm,
          apiKey: 'private-gateway-key',
          baseUrl: 'https://gateway.example.test/zen/v1',
        },
      );
      const model = provider.createModel?.('test-model');
      if (!model) throw new Error('Model missing');
      const result = await generateText({
        model,
        prompt: 'Hello',
        maxOutputTokens: 16,
        maxRetries: 0,
      });
      expect(result.text).toBe('Hello');
      expect(String(fetch.mock.calls[0][0])).toBe(
        `https://gateway.example.test/zen/v1${path}`,
      );
      const headers = new Headers(fetch.mock.calls[0][1]?.headers);
      expect(
        headers.get(
          npm === '@ai-sdk/anthropic' ? 'x-api-key' : 'authorization',
        ),
      ).toBe(
        npm === '@ai-sdk/anthropic'
          ? 'private-gateway-key'
          : 'Bearer private-gateway-key',
      );
    },
  );
});
