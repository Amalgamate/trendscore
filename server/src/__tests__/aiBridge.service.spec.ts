import axios from 'axios';
import { AIBridgeService } from '../services/ai-bridge.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const originalEnv = { ...process.env };

describe('AIBridgeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.AI_TIMEOUT_MS;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_URL;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_URL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends Anthropic requests to the messages endpoint and normalizes usage', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        model: 'claude-test',
        content: [{ type: 'text', text: 'Pathway guidance' }],
        usage: { input_tokens: 12, output_tokens: 8 },
      },
    } as any);
    const service = new AIBridgeService({
      provider: 'anthropic',
      apiKey: 'anthropic-key',
      baseUrl: 'https://anthropic.example/v1/',
      timeoutMs: 4_000,
    });

    const result = await service.generateCompletion('Guide this learner', {
      model: 'claude-test',
      temperature: 0.2,
      maxTokens: 500,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://anthropic.example/v1/messages',
      expect.objectContaining({
        model: 'claude-test',
        max_tokens: 500,
        temperature: 0.2,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'anthropic-key' }),
        timeout: 4_000,
      }),
    );
    expect(result).toEqual({
      content: 'Pathway guidance',
      usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
      provider: 'anthropic',
      model: 'claude-test',
    });
  });

  it('uses OpenAI credentials, endpoint, JSON mode, and response metadata', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        model: 'gpt-test',
        choices: [{ message: { content: '{"pathway":"STEM"}' } }],
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
      },
    } as any);
    const service = new AIBridgeService({
      provider: 'openai',
      apiKey: 'openai-key',
      baseUrl: 'https://openai.example/v1',
    });

    const result = await service.generateCompletion('Recommend a pathway', {
      model: 'gpt-test',
      jsonMode: true,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://openai.example/v1/chat/completions',
      expect.objectContaining({
        model: 'gpt-test',
        response_format: { type: 'json_object' },
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer openai-key' }),
      }),
    );
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-test');
    expect(result.content).toBe('{"pathway":"STEM"}');
  });

  it('allows a scoped provider config to override service defaults', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'Saved settings used' } }] },
    } as any);
    const service = new AIBridgeService({
      provider: 'anthropic',
      apiKey: 'default-key',
      baseUrl: 'https://anthropic.example/v1',
    });

    await service.generateCompletion('Draft an email', { model: 'saved-model' }, {
      provider: 'openai',
      apiKey: 'saved-key',
      apiUrl: 'https://school-openai.example/chat/completions',
      timeoutMs: 12_000,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://school-openai.example/chat/completions',
      expect.objectContaining({ model: 'saved-model' }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer saved-key' }),
        timeout: 12_000,
      }),
    );
  });

  it('uses encrypted-settings resolver output for the shared assistant', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        model: 'claude-saved',
        content: [{ type: 'text', text: 'Saved Anthropic settings used' }],
        usage: { input_tokens: 4, output_tokens: 5 },
      },
    } as any);
    const service = new AIBridgeService({}, async () => ({
      enabled: true,
      provider: 'anthropic',
      apiKey: 'saved-anthropic-key',
      model: 'claude-saved',
      apiUrl: 'https://api.anthropic.test/v1/messages',
    }));

    const result = await service.generateCompletion('Explain this card');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.anthropic.test/v1/messages',
      expect.objectContaining({ model: 'claude-saved' }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'saved-anthropic-key' }),
      }),
    );
    expect(result.provider).toBe('anthropic');
  });

  it('honors the AI tools disabled setting', async () => {
    const service = new AIBridgeService({}, async () => ({
      enabled: false,
      provider: 'anthropic',
    }));

    await expect(service.generateCompletion('Hello')).rejects.toMatchObject({
      statusCode: 503,
      code: 'AI_PROVIDER_DISABLED',
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('selects OpenAI from provider-specific environment configuration', async () => {
    process.env.OPENAI_API_KEY = 'environment-openai-key';
    process.env.OPENAI_BASE_URL = 'https://environment-openai.example/v1';
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'Environment response' } }] },
    } as any);

    const result = await new AIBridgeService().generateCompletion('Hello');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://environment-openai.example/v1/chat/completions',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer environment-openai-key' }),
      }),
    );
    expect(result.provider).toBe('openai');
  });

  it('supports asynchronous deterministic fallback behavior', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network unavailable'));
    const service = new AIBridgeService({
      provider: 'openai',
      apiKey: 'openai-key',
      baseUrl: 'https://openai.example/v1',
    });

    const result = await service.generateCompletionWithFallback(
      'Recommend a pathway',
      {},
      async () => 'Deterministic recommendation',
    );

    expect(result).toBe('Deterministic recommendation');
  });

  it('rejects unsupported providers before making a request', async () => {
    const service = new AIBridgeService({
      provider: 'unsupported' as any,
      apiKey: 'key',
    });

    await expect(service.generateCompletion('Hello')).rejects.toMatchObject({
      statusCode: 400,
      code: 'AI_PROVIDER_UNSUPPORTED',
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
