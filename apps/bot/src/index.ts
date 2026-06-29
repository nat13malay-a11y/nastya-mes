import { Bot } from "grammy";
import { startApiServer } from "./api.js";
import { config } from "./config.js";
import { handleIncomingMessage } from "./messages.js";
import { getMessageLimit } from "./supabase.js";

const bot = new Bot(config.BOT_TOKEN);

bot.command("start", async (ctx) => {
  const messageLimit = await getMessageLimit();
  await ctx.reply(`Bot is connected. Current message limit: ${messageLimit}`);
});

bot.on("message", handleIncomingMessage);

bot.catch((error) => {
  console.error("Bot error:", error);
});

startApiServer();

void startTelegramBot();

async function startTelegramBot(): Promise<void> {
  try {
    await bot.start({
      onStart: (botInfo) => {
        console.log(`Bot @${botInfo.username} started`);
      }
    });
  } catch (error) {
    if (isGetUpdatesConflict(error)) {
      console.warn(
        "Telegram bot polling conflict: another instance is using this BOT_TOKEN. Retrying in 30 seconds."
      );
      setTimeout(() => {
        void startTelegramBot();
      }, 30_000);
      return;
    }

    throw error;
  }
}

function isGetUpdatesConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    method?: string;
    error_code?: number;
    description?: string;
  };

  return (
    maybeError.method === "getUpdates" &&
    maybeError.error_code === 409 &&
    Boolean(maybeError.description?.includes("Conflict"))
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    bot.stop();
  });
}
