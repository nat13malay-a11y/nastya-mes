import type { Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { config } from "./config.js";
import { getMessageLimit, supabaseAdmin } from "./supabase.js";

type TelegramMessage = NonNullable<Context["message"]>;

type StoredMessageInput = {
  userId: number;
  chatId: number;
  text: string | null;
  mediaFileId: string | null;
  mediaType: string | null;
};

const MEDIA_FIELDS = [
  "photo",
  "video",
  "animation",
  "document",
  "audio",
  "voice",
  "video_note",
  "sticker"
] as const;

export async function handleIncomingMessage(ctx: Context): Promise<void> {
  const message = ctx.message;

  if (!message?.from) {
    return;
  }

  const userId = message.from.id;
  const chatId = message.chat.id;
  const originalMediaType = getMediaType(message);
  const text = extractText(message);

  await upsertUserProfile(message.from);
  await upsertContactProfile(message);

  let mediaFileId: string | null = null;
  let mediaType: string | null = originalMediaType;

  if (originalMediaType) {
    try {
      mediaFileId = await copyMediaToDump(ctx, chatId, message.message_id);
    } catch (error) {
      mediaType = "protected_or_failed";
      mediaFileId = null;
      console.warn("Failed to copy media to dump channel:", formatError(error));
    }
  }

  await saveMessageWithRetention({
    userId,
    chatId,
    text,
    mediaFileId,
    mediaType
  });
}

function extractText(message: TelegramMessage): string | null {
  const text = "text" in message ? message.text : undefined;
  const caption = "caption" in message ? message.caption : undefined;
  return text ?? caption ?? null;
}

function getMediaType(message: TelegramMessage): string | null {
  for (const mediaField of MEDIA_FIELDS) {
    if (mediaField in message && message[mediaField]) {
      return mediaField;
    }
  }

  return null;
}

async function copyMediaToDump(
  ctx: Context,
  chatId: number,
  messageId: number
): Promise<string> {
  const copiedMessage = await ctx.api.copyMessage(
    config.DUMP_CHANNEL_ID,
    chatId,
    messageId
  );

  return `dump:${config.DUMP_CHANNEL_ID}:${copiedMessage.message_id}`;
}

async function saveMessageWithRetention(input: StoredMessageInput): Promise<void> {
  const isVip = await isVipUser(input.userId);

  if (!isVip) {
    const messageLimit = await getMessageLimit();
    await deleteOldMessagesBeforeInsert(input.userId, messageLimit);
  }

  const { error } = await supabaseAdmin.from("Messages").insert({
    user_id: input.userId,
    chat_id: input.chatId,
    sender: "user",
    text: input.text,
    media_file_id: input.mediaFileId,
    media_type: input.mediaType
  });

  if (error) {
    throw error;
  }
}

async function upsertUserProfile(user: TelegramMessage["from"]): Promise<void> {
  if (!user) {
    return;
  }

  const firstName = user.first_name ?? null;
  const lastName = "last_name" in user ? user.last_name ?? null : null;
  const username = "username" in user ? user.username ?? null : null;
  const displayName = buildDisplayName(user);

  const { error } = await supabaseAdmin.from("Users").upsert(
    {
      telegram_id: user.id,
      username,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    throw error;
  }
}

async function upsertContactProfile(message: TelegramMessage): Promise<void> {
  if (!("contact" in message) || !message.contact?.user_id) {
    return;
  }

  const contact = message.contact;
  const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  const { error } = await supabaseAdmin.from("Users").upsert(
    {
      telegram_id: contact.user_id,
      phone: contact.phone_number.startsWith("+")
        ? contact.phone_number
        : `+${contact.phone_number}`,
      first_name: contact.first_name,
      last_name: contact.last_name ?? null,
      display_name: displayName || `User ${contact.user_id}`,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    throw error;
  }
}

function buildDisplayName(user: TelegramMessage["from"] | UserFromGetMe): string {
  const parts = [
    "first_name" in user ? user.first_name : null,
    "last_name" in user ? user.last_name : null
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if ("username" in user && user.username) {
    return `@${user.username}`;
  }

  return `User ${user.id}`;
}

async function isVipUser(userId: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("VIP_Users")
    .select("telegram_id")
    .eq("telegram_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function deleteOldMessagesBeforeInsert(
  userId: number,
  messageLimit: number
): Promise<void> {
  const { count, error: countError } = await supabaseAdmin
    .from("Messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    throw countError;
  }

  const currentCount = count ?? 0;
  const messagesToDelete = currentCount - messageLimit + 1;

  if (messagesToDelete <= 0) {
    return;
  }

  const { data: oldestMessages, error: selectError } = await supabaseAdmin
    .from("Messages")
    .select("id")
    .eq("user_id", userId)
    .order("timestamp", { ascending: true })
    .order("id", { ascending: true })
    .limit(messagesToDelete);

  if (selectError) {
    throw selectError;
  }

  const idsToDelete = oldestMessages.map((message) => message.id);

  if (idsToDelete.length === 0) {
    return;
  }

  const { error: deleteError } = await supabaseAdmin
    .from("Messages")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    throw deleteError;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
