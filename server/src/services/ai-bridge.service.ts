/**
 * Unified text-generation interface for Anthropic and OpenAI.
 *
 * Provider configuration is resolved for every request so environment changes
 * and scoped credentials (for example Communication Settings) are respected.
 */

import axios from 'axios';
import { ApiError } from '../utils/error.util';
import logger from '../utils/logger';
import { resolveActiveAISettings } from './ai-settings.service';

export type AIProvider = 'anthropic' | 'openai';

export interface PromptOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  jsonMode?: boolean;
}

export interface AIProviderConfig {
  provider?: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  apiUrl?: string;
  timeoutMs?: number;
}

export interface AIProviderSettings extends AIProviderConfig {
  enabled?: boolean;
  model?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: AIProvider;
  model: string;
}

interface ResolvedProviderConfig {
  provider: AIProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
  timeoutMs: number;
}

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant in a School Management System.';
const DEFAULT_TIMEOUT_MS = 30_000;
const PROVIDER_DEFAULTS: Record<AIProvider, { baseUrl: string; endpoint: string; model: string }> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    endpoint: '/messages',
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    endpoint: '/chat/completions',
    model: 'gpt-4o-mini',
  },
};

const clean = (value: string | undefined) => value?.trim() || undefined;

const endpointFromBaseUrl = (baseUrl: string, endpoint: string) => {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith(endpoint) ? normalized : `${normalized}${endpoint}`;
};

const positiveInteger = (value: number | string | undefined, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export class AIBridgeService {
  constructor(
    private readonly defaults: AIProviderConfig = {},
    private readonly settingsResolver?: () => Promise<AIProviderSettings>,
  ) {}

  async generateCompletion(
    prompt: string,
    options: PromptOptions = {},
    providerOverrides: AIProviderConfig = {},
  ): Promise<AIResponse> {
    if (!prompt.trim()) throw new ApiError(400, 'AI prompt cannot be empty');

    const persistedSettings = this.settingsResolver ? await this.settingsResolver() : {};
    const config = this.resolveConfig(options, providerOverrides, persistedSettings);
    if (config.provider === 'anthropic') {
      return this.callAnthropic(prompt, options, config);
    }
    return this.callOpenAI(prompt, options, config);
  }

  async generateCompletionWithFallback(
    prompt: string,
    options: PromptOptions,
    fallbackFn: () => string | Promise<string>,
    providerOverrides: AIProviderConfig = {},
  ): Promise<string> {
    try {
      const result = await this.generateCompletion(prompt, options, providerOverrides);
      return result.content;
    } catch (error) {
      logger.warn({ error: (error as Error)?.message }, '[AIBridge] Provider call failed; using fallback');
      return fallbackFn();
    }
  }

  private resolveConfig(
    options: PromptOptions,
    overrides: AIProviderConfig,
    persisted: AIProviderSettings = {},
  ): ResolvedProviderConfig {
    if (persisted.enabled === false && !overrides.apiKey) {
      throw new ApiError(503, 'AI tools are disabled in Communication Settings.')
        .withCode('AI_PROVIDER_DISABLED');
    }

    const provider = this.resolveProvider(overrides.provider ?? this.defaults.provider ?? persisted.provider);
    const defaults = PROVIDER_DEFAULTS[provider];
    const apiKey = clean(overrides.apiKey)
      ?? clean(this.defaults.apiKey)
      ?? clean(persisted.apiKey)
      ?? clean(process.env.AI_API_KEY)
      ?? clean(provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);

    if (!apiKey) {
      const providerKey = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      throw new ApiError(500, `AI API key is not configured for ${provider} (set AI_API_KEY or ${providerKey})`)
        .withCode('AI_PROVIDER_NOT_CONFIGURED');
    }

    const explicitApiUrl = clean(overrides.apiUrl) ?? clean(this.defaults.apiUrl) ?? clean(persisted.apiUrl);
    const providerApiUrl = provider === 'anthropic'
      ? clean(process.env.ANTHROPIC_API_URL)
      : clean(process.env.OPENAI_API_URL);
    const configuredBaseUrl = clean(overrides.baseUrl) ?? clean(this.defaults.baseUrl);
    const environmentBaseUrl = clean(provider === 'anthropic' ? process.env.ANTHROPIC_BASE_URL : process.env.OPENAI_BASE_URL)
      ?? clean(process.env.AI_BASE_URL)
      ?? defaults.baseUrl;
    const apiUrl = explicitApiUrl
      ?? (configuredBaseUrl
        ? endpointFromBaseUrl(configuredBaseUrl, defaults.endpoint)
        : providerApiUrl ?? endpointFromBaseUrl(environmentBaseUrl, defaults.endpoint));

    const model = clean(options.model)
      ?? clean(persisted.model)
      ?? clean(provider === 'anthropic' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL)
      ?? clean(process.env.AI_MODEL)
      ?? defaults.model;
    const timeoutMs = positiveInteger(
      overrides.timeoutMs ?? this.defaults.timeoutMs ?? process.env.AI_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    );

    return { provider, apiKey, apiUrl, model, timeoutMs };
  }

  private resolveProvider(configuredProvider?: AIProvider): AIProvider {
    const raw = clean(configuredProvider)
      ?? clean(process.env.AI_PROVIDER)
      ?? (clean(process.env.ANTHROPIC_API_KEY) ? 'anthropic' : undefined)
      ?? (clean(process.env.OPENAI_API_KEY) ? 'openai' : undefined)
      ?? 'anthropic';
    const provider = raw.toLowerCase();
    if (provider !== 'anthropic' && provider !== 'openai') {
      throw new ApiError(400, `Unsupported AI provider: ${raw}. Use 'anthropic' or 'openai'.`)
        .withCode('AI_PROVIDER_UNSUPPORTED');
    }
    return provider;
  }

  private async callAnthropic(
    prompt: string,
    options: PromptOptions,
    config: ResolvedProviderConfig,
  ): Promise<AIResponse> {
    const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const system = options.jsonMode
      ? `${systemPrompt} Respond with valid JSON only. Do not use markdown or code fences.`
      : systemPrompt;

    try {
      const response = await axios.post(
        config.apiUrl,
        {
          model: config.model,
          max_tokens: options.maxTokens ?? 1024,
          temperature: options.temperature,
          system,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: config.timeoutMs,
        },
      );

      const data = response.data || {};
      const content = Array.isArray(data.content)
        ? data.content.filter((block: any) => block?.type === 'text').map((block: any) => block.text).join('')
        : '';
      const promptTokens = data.usage?.input_tokens ?? 0;
      const completionTokens = data.usage?.output_tokens ?? 0;
      return {
        content,
        usage: data.usage ? {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        } : undefined,
        provider: 'anthropic',
        model: data.model || config.model,
      };
    } catch (error) {
      throw this.toProviderError('anthropic', error);
    }
  }

  private async callOpenAI(
    prompt: string,
    options: PromptOptions,
    config: ResolvedProviderConfig,
  ): Promise<AIResponse> {
    try {
      const response = await axios.post(
        config.apiUrl,
        {
          model: config.model,
          messages: [
            { role: 'system', content: options.systemPrompt || DEFAULT_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          response_format: options.jsonMode ? { type: 'json_object' } : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: config.timeoutMs,
        },
      );

      const data = response.data || {};
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens,
          completionTokens,
          totalTokens: data.usage.total_tokens ?? promptTokens + completionTokens,
        } : undefined,
        provider: 'openai',
        model: data.model || config.model,
      };
    } catch (error) {
      throw this.toProviderError('openai', error);
    }
  }

  private toProviderError(provider: AIProvider, error: unknown): ApiError {
    const upstream = error as { message?: string; code?: string; response?: { status?: number; data?: any } };
    const status = upstream.response?.status;
    const message = upstream.response?.data?.error?.message || upstream.message || 'Unknown provider error';
    logger.error({ provider, status, code: upstream.code, message }, '[AIBridge] Provider request failed');

    const statusCode = status === 429 ? 429 : 502;
    return new ApiError(statusCode, `${provider} AI request failed: ${message}`)
      .withCode(status === 429 ? 'AI_PROVIDER_RATE_LIMITED' : 'AI_PROVIDER_REQUEST_FAILED');
  }
}

export const aiBridgeService = new AIBridgeService({}, resolveActiveAISettings);
