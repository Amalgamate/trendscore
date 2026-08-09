import prisma from '../config/database';
import { decrypt } from '../utils/encryption.util';
import logger from '../utils/logger';
import type { AIProvider, AIProviderSettings } from './ai-bridge.service';

export type AIMode = AIProvider | 'workflow';

export const AI_PROVIDER_DEFAULTS: Record<AIProvider, { model: string; apiUrl: string }> = {
  anthropic: {
    model: 'claude-sonnet-4-20250514',
    apiUrl: 'https://api.anthropic.com/v1/messages',
  },
  openai: {
    model: 'gpt-4o-mini',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
  },
};

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object');

export const isAIProvider = (value: unknown): value is AIProvider => value === 'anthropic' || value === 'openai';
export const isAIMode = (value: unknown): value is AIMode => value === 'workflow' || isAIProvider(value);

const endpointFromBaseUrl = (baseUrl: string, provider: AIProvider) => {
  const endpoint = provider === 'anthropic' ? '/messages' : '/chat/completions';
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith(endpoint) ? normalized : `${normalized}${endpoint}`;
};

const getEnvironmentMode = (): AIMode => {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (isAIMode(configured)) return configured;
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  if (process.env.AI_API_KEY?.trim()) return 'openai';
  return 'workflow';
};

const getEnvironmentSettings = (provider: AIProvider, selectedProvider: AIProvider) => {
  const providerKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  const genericKey = provider === selectedProvider ? process.env.AI_API_KEY : undefined;
  const providerModel = provider === 'anthropic' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL;
  const providerApiUrl = provider === 'anthropic' ? process.env.ANTHROPIC_API_URL : process.env.OPENAI_API_URL;
  const providerBaseUrl = provider === 'anthropic' ? process.env.ANTHROPIC_BASE_URL : process.env.OPENAI_BASE_URL;
  const genericBaseUrl = provider === selectedProvider ? process.env.AI_BASE_URL : undefined;

  return {
    apiKey: providerKey?.trim() || genericKey?.trim() || undefined,
    model: providerModel?.trim()
      || (provider === selectedProvider ? process.env.AI_MODEL?.trim() : undefined)
      || AI_PROVIDER_DEFAULTS[provider].model,
    apiUrl: providerApiUrl?.trim()
      || (providerBaseUrl?.trim() ? endpointFromBaseUrl(providerBaseUrl.trim(), provider) : undefined)
      || (genericBaseUrl?.trim() ? endpointFromBaseUrl(genericBaseUrl.trim(), provider) : undefined)
      || AI_PROVIDER_DEFAULTS[provider].apiUrl,
  };
};

export const getStoredAIConfig = (templates: unknown) => {
  if (!isRecord(templates)) return {} as Record<string, any>;
  return isRecord(templates.__ai) ? templates.__ai : {};
};

export const getStoredProviderConfig = (ai: Record<string, any>, provider: AIProvider) => {
  if (isRecord(ai.providers) && isRecord(ai.providers[provider])) return ai.providers[provider];
  const legacyProvider = isAIProvider(ai.provider) ? ai.provider : 'openai';
  if (legacyProvider === provider) {
    return {
      apiKey: ai.apiKey,
      model: ai.model,
      apiUrl: ai.apiUrl,
    };
  }
  return {};
};

const resolveSelectedMode = (ai: Record<string, any>): AIMode => (
  isAIMode(ai.provider) ? ai.provider : getEnvironmentMode()
);

export const getPublicAISettings = (templates: unknown) => {
  const ai = getStoredAIConfig(templates);
  const selectedMode = resolveSelectedMode(ai);
  const environmentProvider: AIProvider = selectedMode === 'workflow' ? 'openai' : selectedMode;

  const providers = (['anthropic', 'openai'] as AIProvider[]).reduce((result, provider) => {
    const stored = getStoredProviderConfig(ai, provider);
    const environment = getEnvironmentSettings(provider, environmentProvider);
    const hasSavedKey = typeof stored.apiKey === 'string' && stored.apiKey.length > 0;
    const hasEnvironmentKey = Boolean(environment.apiKey);
    result[provider] = {
      model: String(stored.model || environment.model),
      apiUrl: String(stored.apiUrl || environment.apiUrl),
      hasApiKey: hasSavedKey || hasEnvironmentKey,
      source: hasSavedKey ? 'settings' : hasEnvironmentKey ? 'environment' : 'none',
    };
    return result;
  }, {} as Record<AIProvider, { model: string; apiUrl: string; hasApiKey: boolean; source: string }>);

  const publicProviders = {
    workflow: {
      model: 'deterministic-v1',
      apiUrl: 'Built into TrendSCORE',
      hasApiKey: true,
      source: 'built-in',
    },
    ...providers,
  };

  if (selectedMode === 'workflow') {
    return {
      enabled: ai.enabled !== undefined ? Boolean(ai.enabled) : true,
      provider: 'workflow' as const,
      ...publicProviders.workflow,
      providers: publicProviders,
    };
  }

  const selected = providers[selectedMode];
  return {
    enabled: ai.enabled !== undefined ? Boolean(ai.enabled) : selected.hasApiKey,
    provider: selectedMode,
    ...selected,
    providers: publicProviders,
  };
};

let cachedSettings: { expiresAt: number; value: AIProviderSettings } | null = null;
let cachedMode: { expiresAt: number; value: AIMode } | null = null;

export const clearAISettingsCache = () => {
  cachedSettings = null;
  cachedMode = null;
};

export const resolveActiveAIMode = async (): Promise<AIMode> => {
  if (cachedMode && cachedMode.expiresAt > Date.now()) return cachedMode.value;
  const config = await prisma.communicationConfig.findFirst({ select: { emailTemplates: true } });
  const mode = resolveSelectedMode(getStoredAIConfig(config?.emailTemplates));
  cachedMode = { expiresAt: Date.now() + 10_000, value: mode };
  return mode;
};

export const resolveActiveAISettings = async (): Promise<AIProviderSettings> => {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) return cachedSettings.value;

  const config = await prisma.communicationConfig.findFirst({ select: { emailTemplates: true } });
  const ai = getStoredAIConfig(config?.emailTemplates);
  const mode = resolveSelectedMode(ai);
  if (mode === 'workflow') {
    const value: AIProviderSettings = { enabled: false, provider: 'anthropic' };
    cachedSettings = { expiresAt: Date.now() + 10_000, value };
    return value;
  }
  const provider = mode;
  const stored = getStoredProviderConfig(ai, provider);
  const environment = getEnvironmentSettings(provider, provider);

  let savedKey: string | undefined;
  if (typeof stored.apiKey === 'string' && stored.apiKey) {
    try {
      savedKey = decrypt(stored.apiKey);
    } catch (error: any) {
      logger.warn({ provider, message: error?.message }, '[AISettings] Saved provider key could not be decrypted; using environment fallback');
    }
  }

  const value: AIProviderSettings = {
    enabled: ai.enabled !== undefined ? Boolean(ai.enabled) : Boolean(savedKey || environment.apiKey),
    provider,
    apiKey: savedKey || environment.apiKey,
    model: String(stored.model || environment.model),
    apiUrl: String(stored.apiUrl || environment.apiUrl),
  };

  cachedSettings = { expiresAt: Date.now() + 10_000, value };
  return value;
};
