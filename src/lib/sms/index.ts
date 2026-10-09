import { env } from "@/lib/env";

import { sendEbitsSms, type SendSmsResult } from "./ebits";

export type { SendSmsResult };

export function buildCredentialsSms(email: string, password: string): string {
  return `Your AssetTrack login: ${email} Temp password: ${password} Change it on first login.`;
}

export async function sendSms(params: {
  to: string;
  message: string;
}): Promise<SendSmsResult> {
  const provider = env.SMS_PROVIDER ?? "ebits";

  if (provider === "ebits") {
    return sendEbitsSms(params);
  }

  return { ok: false, error: `Unsupported SMS provider: ${provider}` };
}
