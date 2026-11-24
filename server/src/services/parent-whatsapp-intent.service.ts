import axios from 'axios';
import logger from '../utils/logger';

export type ParentWhatsAppIntent = 'FEES' | 'RESULTS' | 'HELP';

function deterministicIntent(message: string): ParentWhatsAppIntent {
  const text = message.toLowerCase();
  if (/\b(fee|fees|balance|invoice|owing|owe|payment|paid|pay|arrears|mpesa|m-pesa)\b/.test(text)) return 'FEES';
  if (/\b(result|results|score|scores|grade|grades|marks|report|exam|assessment|performance)\b/.test(text)) return 'RESULTS';
  return 'HELP';
}

const isIntent = (value: unknown): value is ParentWhatsAppIntent =>
  value === 'FEES' || value === 'RESULTS' || value === 'HELP';

export async function classifyParentWhatsAppIntent(message: string): Promise<ParentWhatsAppIntent> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return deterministicIntent(message);

  try {
    const response = await axios.post(`${baseUrl}/api/generate`, {
      model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
      stream: false,
      format: {
        type: 'object',
        properties: { intent: { type: 'string', enum: ['FEES', 'RESULTS', 'HELP'] } },
        required: ['intent'],
      },
      options: { temperature: 0, num_predict: 24 },
      prompt: [
        'Classify the parent message into exactly one allowed intent: FEES, RESULTS, HELP.',
        'FEES means a school fee balance, invoice, or payment question.',
        'RESULTS means a learner assessment, exam score, grade, or report question.',
        'HELP means greetings, link commands, or anything else.',
        'Return only JSON matching {"intent":"FEES|RESULTS|HELP"}.',
        `Parent message: ${message.slice(0, 1000)}`,
      ].join('\n'),
    }, { timeout: Number(process.env.OLLAMA_INTENT_TIMEOUT_MS || 1800) });

    const parsed = JSON.parse(String(response.data?.response || '{}'));
    if (isIntent(parsed.intent)) return parsed.intent;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : 'unknown' }, '[ParentWhatsApp] Ollama intent classification unavailable; using local rules');
  }

  return deterministicIntent(message);
}
