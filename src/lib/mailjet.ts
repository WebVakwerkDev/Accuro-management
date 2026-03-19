const MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send";

export interface MailjetAttachment {
  ContentType: string;
  Filename: string;
  Base64Content: string;
}

export interface SendMailjetOptions {
  fromEmail: string;
  fromName: string;
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  subject: string;
  textPart: string;
  htmlPart?: string;
  replyToMessageId?: string;
  attachments?: MailjetAttachment[];
}

export interface SendMailjetResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendViaMailjet(
  options: SendMailjetOptions,
  apiKey: string,
  apiSecret: string
): Promise<SendMailjetResult> {
  const message: Record<string, unknown> = {
    From: { Email: options.fromEmail, Name: options.fromName },
    To: options.to.map((t) => ({ Email: t.email, Name: t.name ?? "" })),
    Subject: options.subject,
    TextPart: options.textPart,
  };

  if (options.htmlPart) {
    message.HTMLPart = options.htmlPart;
  }
  if (options.cc?.length) {
    message.Cc = options.cc.map((c) => ({ Email: c.email, Name: c.name ?? "" }));
  }
  if (options.replyToMessageId) {
    message.Headers = { "In-Reply-To": options.replyToMessageId };
  }
  if (options.attachments?.length) {
    message.Attachments = options.attachments;
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const res = await fetch(MAILJET_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({ Messages: [message] }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Mailjet ${res.status}: ${text.slice(0, 200)}` };
  }

  const json = (await res.json()) as {
    Messages?: [{ MessageID?: string | number; Status?: string }];
  };

  const messageId = json.Messages?.[0]?.MessageID
    ? String(json.Messages[0].MessageID)
    : undefined;

  return { success: true, messageId };
}

// Parse "Name <email@domain.com>" or "email@domain.com"
export function parseAddressField(raw: string): { name: string | null; email: string } {
  const match = raw.trim().match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim() || null, email: match[2].trim() };
  return { name: null, email: raw.trim() };
}

// Parse comma-separated addresses to plain email strings
export function parseAddressList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((addr) => {
      const m = addr.match(/<(.+?)>/);
      return m ? m[1].trim() : addr.trim();
    })
    .filter(Boolean);
}
