import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { getMessageLimit, setMessageLimit, supabaseAdmin } from "./supabase.js";
import { verifyTelegramInitData } from "./telegramAuth.js";
import { resolveVipInput } from "./vip.js";

export function startApiServer(): void {
  const app = express();

  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json());
  app.use(requireTelegramAuth);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/chats", async (req, res, next) => {
    try {
      const query = String(req.query.q ?? "").trim().toLowerCase();
      const { data, error } = await supabaseAdmin
        .from("Chat_List")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) {
        throw error;
      }

      const chats = query
        ? data.filter((chat) =>
            [
              chat.display_name,
              chat.username,
              String(chat.user_id),
              chat.last_message_preview
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query))
          )
        : data;

      res.json({ chats });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/chats/:userId/messages", async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);

      if (!Number.isSafeInteger(userId)) {
        res.status(400).json({ error: "Invalid userId" });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from("Messages")
        .select("id,user_id,chat_id,sender,text,media_file_id,media_type,timestamp")
        .eq("user_id", userId)
        .order("timestamp", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        throw error;
      }

      res.json({ messages: data });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chats/:userId/favorite", async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);

      if (!Number.isSafeInteger(userId)) {
        res.status(400).json({ error: "Invalid userId" });
        return;
      }

      const { error } = await supabaseAdmin
        .from("VIP_Users")
        .upsert({ telegram_id: userId }, { onConflict: "telegram_id" });

      if (error) {
        throw error;
      }

      res.json({ telegramId: userId, isFavorite: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings", async (_req, res, next) => {
    try {
      const messageLimit = await getMessageLimit();
      res.json({ messageLimit });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings", async (req, res, next) => {
    try {
      const messageLimit = Number(req.body.messageLimit);

      if (![10, 15, 20, 25, 30].includes(messageLimit)) {
        res.status(400).json({ error: "messageLimit must be 10, 15, 20, 25, or 30" });
        return;
      }

      const updatedLimit = await setMessageLimit(messageLimit);
      res.json({ messageLimit: updatedLimit });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/vip", async (req, res, next) => {
    try {
      const input = String(req.body.input ?? "");
      const resolved = await resolveVipInput(input);

      if ("error" in resolved) {
        res.status(400).json({ error: resolved.error });
        return;
      }

      const { error } = await supabaseAdmin
        .from("VIP_Users")
        .upsert({ telegram_id: resolved.telegramId }, { onConflict: "telegram_id" });

      if (error) {
        throw error;
      }

      res.json({
        telegramId: resolved.telegramId,
        source: resolved.source
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(config.API_PORT, "0.0.0.0", () => {
    console.log(`API server listening on 0.0.0.0:${config.API_PORT}`);
  });
}

function requireTelegramAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health") {
    next();
    return;
  }

  const initData = req.header("x-telegram-init-data");

  if (!initData && process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  if (!initData || !verifyTelegramInitData(initData)) {
    res.status(401).json({ error: "Invalid Telegram init data" });
    return;
  }

  next();
}
