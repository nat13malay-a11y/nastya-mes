import { supabaseAdmin } from "./supabase.js";

type VipResolution =
  | { telegramId: number; source: "id" | "known_username" | "known_phone" }
  | { error: string };

export async function resolveVipInput(rawInput: string): Promise<VipResolution> {
  const normalized = normalizeVipInput(rawInput);

  if (!normalized) {
    return { error: "Введите Telegram ID, @username, t.me/username или телефон." };
  }

  if (normalized.kind === "id") {
    return { telegramId: normalized.value, source: "id" };
  }

  const user = await findKnownUser(normalized.kind, normalized.value);

  if (!user) {
    return {
      error:
        "Не удалось получить Telegram ID. Пользователь должен сначала написать боту, после этого username/телефон можно будет сопоставить."
    };
  }

  return {
    telegramId: user.telegram_id,
    source: normalized.kind === "username" ? "known_username" : "known_phone"
  };
}

export function normalizeVipInput(rawInput: string):
  | { kind: "id"; value: number }
  | { kind: "username"; value: string }
  | { kind: "phone"; value: string }
  | null {
  const input = rawInput.trim();

  if (!input) {
    return null;
  }

  if (/^-?\d{5,20}$/.test(input)) {
    return { kind: "id", value: Number(input) };
  }

  const usernameFromUrl = input.match(/^(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})\/?$/);
  if (usernameFromUrl) {
    return { kind: "username", value: usernameFromUrl[1].toLowerCase() };
  }

  const username = input.match(/^@?([a-zA-Z0-9_]{5,32})$/);
  if (username && /[a-zA-Z_]/.test(username[1])) {
    return { kind: "username", value: username[1].toLowerCase() };
  }

  const phone = input.replace(/[\s().-]/g, "");
  if (/^\+\d{7,15}$/.test(phone)) {
    return { kind: "phone", value: phone };
  }

  return null;
}

async function findKnownUser(
  kind: "username" | "phone",
  value: string
): Promise<{ telegram_id: number } | null> {
  const column = kind === "username" ? "username" : "phone";

  const { data, error } = await supabaseAdmin
    .from("Users")
    .select("telegram_id")
    .ilike(column, value)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

