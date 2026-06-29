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

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started`);
  }
});

startApiServer();
