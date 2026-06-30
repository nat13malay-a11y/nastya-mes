import { TelegramClient } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";
import { getListenerConfig } from "./config.js";
import { handleNewMessage } from "./messages.js";

const listenerConfig = getListenerConfig();
const session = new StringSession(listenerConfig.TELEGRAM_SESSION);
const client = new TelegramClient(
  session,
  listenerConfig.TELEGRAM_API_ID,
  listenerConfig.TELEGRAM_API_HASH,
  { connectionRetries: 5 }
);

try {
  await client.connect();
} catch (error) {
  if (isAuthKeyDuplicated(error)) {
    console.error(
      [
        "Telegram rejected TELEGRAM_SESSION with AUTH_KEY_DUPLICATED.",
        "Stop every other user-client process that uses this session, generate a new StringSession with npm run auth, update TELEGRAM_SESSION in Railway, then redeploy only one user-client instance."
      ].join(" ")
    );
    process.exit(0);
  }

  throw error;
}

client.addEventHandler(
  (event) => {
    void handleNewMessage(client, event).catch((error) => {
      console.error("Failed to store Telegram user message:", error);
    });
  },
  new NewMessage({})
);

console.log("Telegram user-client is listening for new messages");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void client.disconnect().finally(() => {
      process.exit(0);
    });
  });
}

await new Promise(() => undefined);

function isAuthKeyDuplicated(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorLike = error as { errorMessage?: unknown; message?: unknown; code?: unknown };
  const message = String(errorLike.errorMessage ?? errorLike.message ?? "");

  return errorLike.code === 406 && message.includes("AUTH_KEY_DUPLICATED");
}
