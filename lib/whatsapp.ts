type SendTextResult = {
  messageId: string;
  timestamp: number;
};

export function normalizeBangladeshPhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  throw new Error(`Invalid Bangladesh WhatsApp number: ${input}`);
}

export function toChatId(input: string) {
  return `${normalizeBangladeshPhone(input)}@c.us`;
}

export class HasibWebWaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly sessionId: string;

  constructor(config?: { baseUrl?: string; apiKey?: string; sessionId?: string }) {
    this.baseUrl = config?.baseUrl || process.env.HASIBWEB_WA_BASE_URL || 'https://wa.hasibweb.com';
    this.apiKey = config?.apiKey || '';
    this.sessionId = config?.sessionId || '';
  }

  assertConfigured() {
    if (!this.apiKey) throw new Error('WhatsApp API key is not configured in Settings.');
    if (!this.sessionId) throw new Error('WhatsApp session ID is not configured in Settings.');
  }

  async sendText(input: { chatId: string; text: string; idempotencyKey: string }) {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}/api/sessions/${this.sessionId}/messages/send-text`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ chatId: input.chatId, text: input.text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HasibWeb WA API failed: ${response.status} ${body}`);
    }

    return (await response.json()) as SendTextResult;
  }
}
