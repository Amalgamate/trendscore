import { getPublicAISettings } from '../services/ai-settings.service';

const originalEnv = { ...process.env };

describe('AI settings service', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.AI_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reports separate write-only provider configurations', () => {
    const result = getPublicAISettings({
      __ai: {
        enabled: true,
        provider: 'anthropic',
        providers: {
          anthropic: {
            apiKey: 'encrypted-anthropic-key',
            model: 'claude-school',
            apiUrl: 'https://anthropic.school/v1/messages',
          },
          openai: {
            model: 'gpt-school',
            apiUrl: 'https://openai.school/v1/chat/completions',
          },
        },
      },
    });

    expect(result).toMatchObject({
      enabled: true,
      provider: 'anthropic',
      model: 'claude-school',
      hasApiKey: true,
      source: 'settings',
      providers: {
        anthropic: { hasApiKey: true, source: 'settings' },
        openai: { hasApiKey: false, source: 'none' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('encrypted-anthropic-key');
  });

  it('detects an Anthropic environment fallback', () => {
    process.env.ANTHROPIC_API_KEY = 'environment-anthropic-key';

    const result = getPublicAISettings(undefined);

    expect(result).toMatchObject({
      enabled: true,
      provider: 'anthropic',
      hasApiKey: true,
      source: 'environment',
    });
  });

  it('defaults to the free built-in workflow when no provider key is configured', () => {
    const result = getPublicAISettings(undefined);

    expect(result).toMatchObject({
      enabled: true,
      provider: 'workflow',
      model: 'deterministic-v1',
      hasApiKey: true,
      source: 'built-in',
    });
  });
});
