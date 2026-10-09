import { env } from "@/lib/env";

export type SendSmsResult =
  | { ok: true }
  | { ok: false; error: string };

type EbitsSendResponse = {
  status?: string;
  message?: string;
};

export async function sendEbitsSms(params: {
  to: string;
  message: string;
}): Promise<SendSmsResult> {
  const baseUrl = env.EBITS_SMS_BASE_URL;
  const apiKey = env.EBITS_SMS_API_KEY;
  const senderId = env.EBITS_SMS_SENDER_ID;

  if (!baseUrl || !apiKey || !senderId) {
    return {
      ok: false,
      error: "SMS is not configured (missing EBITS_SMS_* env vars).",
    };
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/v2/sms/send`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: senderId,
        message: params.message,
        recipients: [params.to],
      }),
    });

    let body: EbitsSendResponse | null = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text) as EbitsSendResponse;
      } catch {
        body = null;
      }
    }

    if (!res.ok) {
      console.error("[sms/ebits] HTTP error", res.status, text.slice(0, 200));
      return {
        ok: false,
        error: `SMS provider returned HTTP ${res.status}.`,
      };
    }

    if (
      body?.status &&
      body.status.toLowerCase() !== "success"
    ) {
      console.error("[sms/ebits] Non-success status", body.status);
      return {
        ok: false,
        error: body.message ?? `SMS provider status: ${body.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("[sms/ebits] Request failed", error);
    return { ok: false, error: "Failed to reach SMS provider." };
  }
}
