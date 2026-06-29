import {
  ArrowLeft,
  Crown,
  Image,
  MoreHorizontal,
  Pin,
  Search,
  Settings,
  Star,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addVipUser,
  favoriteChat,
  getChats,
  getMessages,
  getSettings,
  updateMessageLimit,
  type ChatMessage,
  type ChatSummary
} from "./lib/api.js";
import { telegramApp } from "./lib/telegram.js";
import { normalizeVipInput } from "./lib/vip.js";

type View = "contacts" | "chat";

const MESSAGE_LIMITS = [10, 15, 20, 25, 30];

export function App() {
  const [view, setView] = useState<View>("contacts");
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [messageLimit, setMessageLimit] = useState(10);
  const [vipInput, setVipInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    const nextChats = await getChats(search);
    setChats(nextChats);
  }, [search]);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    loadChats()
      .catch((error) => setNotice(error.message))
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadChats]);

  useEffect(() => {
    getSettings()
      .then((settings) => setMessageLimit(settings.messageLimit))
      .catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    const handleBack = () => {
      if (isSettingsOpen) {
        setSettingsOpen(false);
        return;
      }

      setView("contacts");
      setActiveChat(null);
    };

    if (view === "chat" || isSettingsOpen) {
      telegramApp?.BackButton.show();
      telegramApp?.BackButton.onClick(handleBack);
    } else {
      telegramApp?.BackButton.hide();
    }

    return () => {
      telegramApp?.BackButton.offClick(handleBack);
    };
  }, [isSettingsOpen, view]);

  const openChat = async (chat: ChatSummary) => {
    setActiveChat(chat);
    setView("chat");
    setMessages([]);

    try {
      setMessages(await getMessages(chat.user_id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось открыть чат");
    }
  };

  const closeChat = () => {
    setView("contacts");
    setActiveChat(null);
  };

  const saveMessageLimit = async (value: number) => {
    setMessageLimit(value);

    try {
      const settings = await updateMessageLimit(value);
      setMessageLimit(settings.messageLimit);
      setNotice("Лимит обновлен");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось обновить лимит");
    }
  };

  const submitVip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeVipInput(vipInput);

    if (!normalized) {
      setNotice("Проверь формат: ID, @username, t.me/username или +телефон");
      return;
    }

    try {
      const result = await addVipUser(normalized);
      setVipInput("");
      setNotice(`VIP добавлен: ${result.telegramId}`);
      await loadChats();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось добавить VIP");
    }
  };

  const saveActiveChatForever = async () => {
    if (!activeChat) {
      return;
    }

    try {
      await favoriteChat(activeChat.user_id);
      const nextActiveChat = { ...activeChat, is_vip: true };

      setActiveChat(nextActiveChat);
      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.user_id === activeChat.user_id ? { ...chat, is_vip: true } : chat
        )
      );
      setNotice("Чат добавлен в избранные и будет храниться полностью");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось добавить в избранные");
    }
  };

  const activeTitle = activeChat?.display_name ?? "Чат";
  const filteredChats = useMemo(() => chats, [chats]);

  return (
    <main className="app-shell">
      <section className={`view-stack ${view === "chat" ? "is-chat-open" : ""}`}>
        <div className="contacts-view">
          <header className="contacts-header">
            <label className="search-box">
              <Search size={22} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск"
              />
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label="Настройки"
              title="Настройки"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={22} />
            </button>
          </header>

          <div className="chat-tabs" aria-label="Фильтры">
            <button className="is-active" type="button">
              Все
            </button>
            <button type="button">
              VIP <span>{chats.filter((chat) => chat.is_vip).length}</span>
            </button>
            <button type="button">Медиа</button>
          </div>

          <div className="chat-list">
            {isLoading ? (
              <p className="empty-state">Загрузка...</p>
            ) : filteredChats.length === 0 ? (
              <p className="empty-state">Пока нет сообщений</p>
            ) : (
              filteredChats.map((chat) => (
                <button
                  className="chat-row"
                  key={chat.user_id}
                  type="button"
                  onClick={() => void openChat(chat)}
                >
                  <Avatar chat={chat} />
                  <span className="chat-main">
                    <span className="chat-title-line">
                      <strong>{chat.display_name}</strong>
                      {chat.is_vip ? <Crown size={17} aria-label="VIP" /> : null}
                    </span>
                    <span className="chat-preview">{chat.last_message_preview}</span>
                  </span>
                  <span className="chat-meta">
                    <time>{formatListTime(chat.last_message_at)}</time>
                    <Pin size={20} aria-hidden="true" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="chat-view" aria-hidden={view !== "chat"}>
          <header className="chat-header">
            <button
              className="back-button"
              type="button"
              aria-label="Назад"
              onClick={closeChat}
            >
              <ArrowLeft size={30} />
            </button>
            <div className="chat-heading">
              <strong>{activeTitle}</strong>
              <span>был(а) недавно</span>
            </div>
            {activeChat ? <Avatar chat={activeChat} compact /> : <span />}
          </header>

          <div className="pinned-message">
            <span />
            <div>
              <strong>Закрепленное сообщение</strong>
              <p>{activeChat ? activeChat.user_id : "ID пользователя"}</p>
            </div>
            <MoreHorizontal size={24} aria-hidden="true" />
          </div>

          {activeChat ? (
            <button
              className={`favorite-chat-button ${activeChat.is_vip ? "is-active" : ""}`}
              type="button"
              onClick={() => void saveActiveChatForever()}
              disabled={activeChat.is_vip}
            >
              <Star size={19} fill={activeChat.is_vip ? "currentColor" : "none"} />
              <span>{activeChat.is_vip ? "В избранных" : "Избранные"}</span>
            </button>
          ) : null}

          <div className="messages-list">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>
      </section>

      {isSettingsOpen ? (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <div className="settings-modal">
            <header>
              <h2>Настройки</h2>
              <button
                className="icon-button"
                type="button"
                aria-label="Закрыть"
                title="Закрыть"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={22} />
              </button>
            </header>

            <label className="field">
              <span>Лимит сообщений: {messageLimit}</span>
              <input
                type="range"
                min={10}
                max={30}
                step={5}
                value={messageLimit}
                onChange={(event) => void saveMessageLimit(Number(event.target.value))}
              />
              <span className="range-labels">
                {MESSAGE_LIMITS.map((limit) => (
                  <small key={limit}>{limit}</small>
                ))}
              </span>
            </label>

            <form className="vip-form" onSubmit={(event) => void submitVip(event)}>
              <label className="field">
                <span>VIP пользователь</span>
                <input
                  value={vipInput}
                  onChange={(event) => setVipInput(event.target.value)}
                  placeholder="@username, t.me/name, +380... или ID"
                />
              </label>
              <button className="primary-button" type="submit">
                Добавить VIP
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {notice ? (
        <button className="toast" type="button" onClick={() => setNotice(null)}>
          {notice}
        </button>
      ) : null}
    </main>
  );
}

function Avatar({ chat, compact = false }: { chat: ChatSummary; compact?: boolean }) {
  const initials = getInitials(chat.display_name);

  return (
    <span
      className={`avatar ${compact ? "is-compact" : ""}`}
      style={{ "--avatar-hue": getAvatarHue(chat.user_id) } as React.CSSProperties}
    >
      {chat.avatar_url ? <img src={chat.avatar_url} alt="" /> : initials}
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isBot = message.sender === "bot";

  return (
    <article className={`message-bubble ${isBot ? "is-outgoing" : "is-incoming"}`}>
      {message.media_type ? (
        <span className="media-chip">
          <Image size={15} />
          {mediaLabel(message.media_type)}
        </span>
      ) : null}
      {message.text ? <p>{message.text}</p> : null}
      <time>{formatMessageTime(message.timestamp)}</time>
    </article>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function getAvatarHue(id: number): string {
  return `${Math.abs(id) % 360}deg`;
}

function mediaLabel(mediaType: string): string {
  if (mediaType === "protected_or_failed") {
    return "protected";
  }

  return mediaType.replace("_", " ");
}

function formatListTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return formatMessageTime(timestamp);
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit"
  });
}

function formatMessageTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
