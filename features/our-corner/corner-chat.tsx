"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  archiveOurCornerMessage,
  editOurCornerMessage,
  loadOlderOurCornerMessages,
  loadOurCornerState,
  markOurCornerMessagesRead,
  sendOurCornerMessage,
  setOurCornerHeart,
} from "@/app/our-corner/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { CornerMessageView } from "@/lib/our-corner/contracts";
import { CornerSharePicker } from "@/features/our-corner/corner-features";
import { CornerVoicePlayer } from "@/features/our-corner/corner-voice-player";
import { CornerVoiceRecorder } from "@/features/our-corner/corner-voice-recorder";

type ClientMessage = CornerMessageView & { localState?: "sending" | "failed" };
const EDIT_WINDOW_MS = 15 * 60 * 1000;

function mergeMessages(current: ClientMessage[], incoming: CornerMessageView[]) {
  const byClientId = new Map(current.map((message) => [message.clientMessageId, message]));
  for (const message of incoming) byClientId.set(message.clientMessageId, { ...byClientId.get(message.clientMessageId), ...message, localState: undefined });
  return [...byClientId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function CornerChat() {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [conversationRef, setConversationRef] = useState("");
  const [peerLabel, setPeerLabel] = useState<"Brian" | "Jessica">("Jessica");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<CornerMessageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [retry, setRetry] = useState<{ id: string; body: string; replyRef?: string } | null>(null);
  const sendLock = useRef(false);
  const mutationLocks = useRef(new Set<string>());
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyboardFrame = useRef<number | null>(null);
  const historyLock = useRef(false);
  const historyStarted = useRef(false);
  const initialPositioned = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const syncVersion = useRef(0);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptQueue = useRef(new Set<string>());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const syncRecent = useCallback(async () => {
    const version = ++syncVersion.current;
    const result = await loadOurCornerState();
    if (version !== syncVersion.current || !result.ok) return;
    const list = listRef.current;
    const wasNearBottom = Boolean(list && list.scrollHeight - list.scrollTop - list.clientHeight < 120);
    setConversationRef(result.conversationRef);
    setPeerLabel(result.peerLabel);
    setMessages((current) => mergeMessages(current, result.page.messages));
    if (!historyStarted.current) setNextCursor(result.page.nextCursor);
    setLoading(false);
    if (!initialPositioned.current || wasNearBottom) {
      initialPositioned.current = true;
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => {
        scrollFrame.current = requestAnimationFrame(() => {
          scrollFrame.current = null;
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        });
      });
    }
  }, []);

  useEffect(() => {
    void syncRecent();
    const onFocus = () => { if (document.visibilityState === "visible") void syncRecent(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      syncVersion.current += 1;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      if (receiptTimer.current) clearTimeout(receiptTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [syncRecent]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const composer = composerRef.current;
    if (!viewport || !composer) return;
    const updateKeyboardOffset = () => {
      if (keyboardFrame.current !== null) cancelAnimationFrame(keyboardFrame.current);
      keyboardFrame.current = requestAnimationFrame(() => {
        keyboardFrame.current = null;
        const mobileLayout = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
        const focused = document.activeElement === inputRef.current;
        const currentOffset = Number.parseFloat(composer.style.getPropertyValue("--corner-keyboard-offset")) || 0;
        const visualBottom = viewport.offsetTop + viewport.height;
        const naturalBottom = composer.getBoundingClientRect().bottom + currentOffset;
        const offset = mobileLayout && focused ? Math.max(0, naturalBottom - visualBottom + 6) : 0;
        composer.style.setProperty("--corner-keyboard-offset", `${Math.round(offset)}px`);
        if (offset > 0) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    };
    const resetKeyboardOffset = () => {
      if (keyboardFrame.current !== null) cancelAnimationFrame(keyboardFrame.current);
      keyboardFrame.current = null;
      composer.style.setProperty("--corner-keyboard-offset", "0px");
    };
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);
    window.addEventListener("resize", updateKeyboardOffset);
    window.addEventListener("orientationchange", resetKeyboardOffset);
    return () => {
      if (keyboardFrame.current !== null) cancelAnimationFrame(keyboardFrame.current);
      composer.style.removeProperty("--corner-keyboard-offset");
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
      window.removeEventListener("resize", updateKeyboardOffset);
      window.removeEventListener("orientationchange", resetKeyboardOffset);
    };
  }, []);

  useEffect(() => {
    if (!conversationRef) return;
    const supabase = createBrowserSupabaseClient();
    const scheduleSync = () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void syncRecent(), 120);
    };
    const channel = supabase.channel(`our-corner:${conversationRef}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "our_corner_messages" }, scheduleSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "our_corner_message_hearts" }, scheduleSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "our_corner_read_receipts" }, scheduleSync)
      .on("broadcast", { event: "typing" }, () => {
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3200);
      })
      .on("broadcast", { event: "typing-stop" }, () => setTyping(false))
      .subscribe((status) => { if (status === "SUBSCRIBED") void syncRecent(); });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationRef, syncRecent]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    void channelRef.current?.send({ type: "broadcast", event: "typing-stop", payload: {} });
  }, []);

  useEffect(() => {
    const clearTypingWhenHidden = () => {
      if (document.visibilityState !== "visible") stopTyping();
    };
    document.addEventListener("visibilitychange", clearTypingWhenHidden);
    return () => {
      stopTyping();
      document.removeEventListener("visibilitychange", clearTypingWhenHidden);
    };
  }, [stopTyping]);

  const announceTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1200) return;
    lastTypingSent.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: {} });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || body.length > 4000 || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setError("");
    const clientMessageId = retry?.body === body && retry.replyRef === reply?.ref ? retry.id : crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: ClientMessage = {
      ref: `optimistic:${clientMessageId}`,
      clientMessageId,
      kind: "text",
      body,
      senderLabel: "you",
      isOwn: true,
      reply: reply ? { ref: reply.ref, senderLabel: reply.senderLabel, excerpt: reply.body?.slice(0, 120) || "Message", kind: reply.kind } : null,
      heartCount: 0,
      ownHeart: false,
      readByMe: true,
      readByOther: false,
      createdAt,
      editedAt: null,
      archivedAt: null,
      voice: null,
      shared: null,
      localState: "sending",
    };
    setMessages((current) => [...current.filter((message) => message.clientMessageId !== clientMessageId), optimistic]);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    setText("");
    const replyingTo = reply;
    setReply(null);
    stopTyping();
    try {
      const result = await sendOurCornerMessage(clientMessageId, body, replyingTo?.ref);
      if (!result.ok) {
        setRetry({ id: clientMessageId, body, replyRef: replyingTo?.ref });
        setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? { ...message, localState: "failed" } : message));
        setText(body);
        setError(result.error);
        setAnnouncement("Message failed to send. Your text is still in the composer.");
        return;
      }
      setMessages((current) => mergeMessages(current, [result.message]));
      setRetry(null);
      setAnnouncement("Message sent.");
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    } catch {
      setRetry({ id: clientMessageId, body, replyRef: replyingTo?.ref });
      setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? { ...message, localState: "failed" } : message));
      setText(body);
      setError("Your message could not be sent just now.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  const loadOlder = async () => {
    if (!nextCursor || historyLock.current) return;
    historyLock.current = true;
    historyStarted.current = true;
    setLoadingOlder(true);
    const list = listRef.current;
    const previousHeight = list?.scrollHeight ?? 0;
    const previousTop = list?.scrollTop ?? 0;
    try {
      const result = await loadOlderOurCornerMessages(nextCursor);
      if (result.ok) {
        setMessages((current) => mergeMessages(result.page.messages, current));
        setNextCursor(result.page.nextCursor);
        requestAnimationFrame(() => {
          const currentList = listRef.current;
          if (currentList) currentList.scrollTop = previousTop + currentList.scrollHeight - previousHeight;
        });
      } else setError(result.error);
    } catch {
      setError("Earlier messages could not be loaded. Scroll up to try again.");
    } finally {
      historyLock.current = false;
      setLoadingOlder(false);
    }
  };

  const toggleHeart = async (message: ClientMessage) => {
    if (message.ref.startsWith("optimistic:") || mutationLocks.current.has(`heart:${message.ref}`)) return;
    mutationLocks.current.add(`heart:${message.ref}`);
    const active = !message.ownHeart;
    setMessages((current) => current.map((item) => item.ref === message.ref ? { ...item, ownHeart: active, heartCount: Math.max(0, item.heartCount + (active ? 1 : -1)) } : item));
    const result = await setOurCornerHeart(message.ref, active);
    if (!result.ok) {
      setMessages((current) => current.map((item) => item.ref === message.ref ? message : item));
      setError(result.error);
    }
    mutationLocks.current.delete(`heart:${message.ref}`);
  };

  const edit = async (message: ClientMessage) => {
    if (mutationLocks.current.has(`edit:${message.ref}`)) return;
    const body = window.prompt("Edit your message", message.body ?? "");
    if (!body || body === message.body) return;
    mutationLocks.current.add(`edit:${message.ref}`);
    const result = await editOurCornerMessage(message.ref, body);
    if (result.ok) setMessages((current) => mergeMessages(current, [result.message]));
    else setError(result.error);
    mutationLocks.current.delete(`edit:${message.ref}`);
  };

  const archive = async (message: ClientMessage) => {
    if (mutationLocks.current.has(`archive:${message.ref}`) || !window.confirm("Remove this message from the conversation?")) return;
    mutationLocks.current.add(`archive:${message.ref}`);
    const result = await archiveOurCornerMessage(message.ref);
    if (result.ok) setMessages((current) => mergeMessages(current, [result.message]));
    else setError(result.error);
    mutationLocks.current.delete(`archive:${message.ref}`);
  };

  const queueRead = useCallback((message: ClientMessage) => {
    if (message.isOwn || message.readByMe || document.visibilityState !== "visible" || message.ref.startsWith("optimistic:")) return;
    receiptQueue.current.add(message.ref);
    if (receiptTimer.current) return;
    receiptTimer.current = setTimeout(async () => {
      const refs = [...receiptQueue.current];
      receiptQueue.current.clear();
      receiptTimer.current = null;
      if (!refs.length) return;
      const result = await markOurCornerMessagesRead(refs);
      if (result.ok) setMessages((current) => current.map((item) => refs.includes(item.ref) ? { ...item, readByMe: true } : item));
    }, 500);
  }, []);

  const unreadIndex = useMemo(() => messages.findIndex((message) => !message.isOwn && !message.readByMe), [messages]);

  return (
    <>
      <section className="corner-conversation" aria-label="Private conversation">
        <div ref={listRef} className="corner-message-list" onScroll={(event) => {
          if (event.currentTarget.scrollTop < 160 && nextCursor && !historyLock.current) void loadOlder();
        }}>
          {nextCursor ? <button type="button" className="corner-load-older" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? "Loading…" : "Earlier messages"}</button> : null}
          {loading ? <p className="corner-empty">Gathering your conversation…</p> : null}
          {!loading && !messages.length ? <p className="corner-empty">This quiet corner is ready for its first message.</p> : null}
          {messages.map((message, index) => <MessageBubble
            key={message.clientMessageId}
            message={message}
            floatIndex={index % 9}
            showSender={index === 0 || messages[index - 1]?.senderLabel !== message.senderLabel}
            unread={index === unreadIndex}
            onReply={() => setReply(message)}
            onHeart={() => void toggleHeart(message)}
            onEdit={() => void edit(message)}
            onArchive={() => void archive(message)}
            onReadable={() => queueRead(message)}
          />)}
        </div>
        <p className="corner-typing" aria-live="polite">{typing ? `${peerLabel} is typing…` : ""}</p>
      </section>
      <section ref={composerRef} className="corner-composer" aria-label="Message composer">
        {reply ? <div className="corner-compose-reply"><span>Replying to {reply.senderLabel}</span><p>{reply.body?.slice(0, 120) || reply.kind}</p><button type="button" aria-label="Cancel reply" onClick={() => setReply(null)}>×</button></div> : null}
        <textarea
          ref={inputRef}
          aria-label="Message"
          placeholder="Write something for this quiet corner…"
          maxLength={4000}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (retry && event.target.value.trim() !== retry.body) setRetry(null);
            announceTyping();
          }}
          onBlur={() => {
            stopTyping();
            composerRef.current?.style.setProperty("--corner-keyboard-offset", "0px");
          }}
          onFocus={() => {
            if (!window.matchMedia("(max-width: 720px), (pointer: coarse)").matches) return;
            requestAnimationFrame(() => {
              inputRef.current?.scrollIntoView({ block: "nearest" });
              listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
            });
          }}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter"
              && !event.shiftKey
              && !event.nativeEvent.isComposing
              && event.nativeEvent.keyCode !== 229
              && window.matchMedia("(pointer:fine)").matches) {
              event.preventDefault();
              if (text.trim() && !sendLock.current) void send();
            }
          }}
        />
        <div className="corner-composer-actions">
          <small>{text.length}/4000</small>
          <button type="button" aria-expanded={voiceOpen} onClick={() => { setVoiceOpen((value) => !value); setShareOpen(false); }}>Voice</button>
          <button type="button" className="corner-share-button" aria-label="Share something" title="Share something" aria-expanded={shareOpen} onClick={() => { setShareOpen((value) => !value); setVoiceOpen(false); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12.5l6.2-6.2a3 3 0 014.3 4.2l-8.1 8.1a5 5 0 01-7.1-7.1l8.2-8.2" /></svg>
            <span className="sr-only">Share something</span>
          </button>
          <button type="button" className="corner-send-button" disabled={!text.trim() || text.length > 4000 || sending} onClick={() => void send()}>Send</button>
        </div>
        {voiceOpen ? <CornerVoiceRecorder
          replyRef={reply?.ref}
          onClose={() => setVoiceOpen(false)}
          onOptimistic={(message) => setMessages((current) => [...current.filter((item) => item.clientMessageId !== message.clientMessageId), { ...message, localState: "sending" }])}
          onFailed={(clientMessageId) => setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? { ...message, localState: "failed" } : message))}
          onSent={(message) => {
          setMessages((current) => mergeMessages(current, [message]));
          setReply(null);
          setAnnouncement("Voice note sent.");
        }} /> : null}
        {shareOpen ? <CornerSharePicker replyRef={reply?.ref} onClose={() => setShareOpen(false)} onShared={(message) => {
          setMessages((current) => mergeMessages(current, [message]));
          setReply(null);
          setAnnouncement("Shared item sent.");
        }} /> : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}

const MessageBubble = memo(function MessageBubble({ message, floatIndex, showSender, unread, onReply, onHeart, onEdit, onArchive, onReadable }: {
  message: ClientMessage;
  floatIndex: number;
  showSender: boolean;
  unread: boolean;
  onReply: () => void;
  onHeart: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onReadable: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [withinEditWindow, setWithinEditWindow] = useState(() => new Date(message.createdAt).getTime() + EDIT_WINDOW_MS > Date.now());
  useEffect(() => {
    const expiresAt = new Date(message.createdAt).getTime() + EDIT_WINDOW_MS;
    if (expiresAt <= Date.now()) return;
    const timer = setTimeout(() => setWithinEditWindow(false), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [message.createdAt]);
  const editable = message.kind === "text" && message.isOwn && !message.archivedAt && withinEditWindow && !message.ref.startsWith("optimistic:");
  const removable = message.isOwn && !message.archivedAt && withinEditWindow && !message.ref.startsWith("optimistic:");
  useEffect(() => {
    const node = ref.current;
    if (!node || message.isOwn || message.readByMe) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= .6)) onReadable();
    }, { root: node.closest(".corner-message-list"), threshold: .6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [message.isOwn, message.readByMe, onReadable]);
  const scrollToReply = () => {
    if (!message.reply) return;
    document.querySelector<HTMLElement>(`[data-message-ref="${CSS.escape(message.reply.ref)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <>
      {unread ? <div className="corner-unread-marker">Unread</div> : null}
      <article ref={ref} data-message-ref={message.ref} className={`corner-message-anchor ${message.isOwn ? "is-own" : "is-peer"}`}>
        <div className="corner-message-bubble" style={{ "--corner-message-index": floatIndex } as CSSProperties}>
          {showSender ? <small className="corner-message-sender">{message.senderLabel === "you" ? "You" : message.senderLabel}</small> : null}
          {message.reply ? <button type="button" className="corner-reply-preview" aria-label={`Go to message from ${message.reply.senderLabel}`} onClick={scrollToReply}><strong>{message.reply.senderLabel}</strong><span>{message.reply.kind} · {message.reply.excerpt}</span></button> : null}
          {message.archivedAt ? <p>This message was removed.</p> : message.kind === "voice" ? message.ref.startsWith("optimistic:") ? <p>{message.localState === "failed" ? "Voice note failed to send." : "Uploading voice note…"}</p> : <CornerVoicePlayer message={message} /> : message.kind === "shared" && message.shared ? <a className={`corner-shared-preview ${message.shared.available ? "" : "is-unavailable"}`} href={message.shared.href}><strong>{message.shared.title}</strong><span>{message.shared.detail}</span><small>{message.shared.available ? "Open protected world" : "Unavailable"}</small></a> : <p>{message.body}</p>}
          <footer><time dateTime={message.createdAt}>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}</time>{message.editedAt ? <span>Edited</span> : null}{message.isOwn ? <span>{message.localState === "sending" ? "Sending" : message.localState === "failed" ? "Failed" : message.readByOther ? "Read" : "Delivered"}</span> : null}</footer>
          <div className="corner-message-actions">
            {!message.archivedAt && !message.ref.startsWith("optimistic:") ? <button type="button" onClick={onReply}>Reply</button> : null}
            {!message.ref.startsWith("optimistic:") ? <button type="button" className="corner-message-heart" aria-label={`${message.ownHeart ? "Remove" : "Add"} heart`} aria-pressed={message.ownHeart} onClick={onHeart}><span aria-hidden="true">{message.ownHeart ? "❤️" : "♡"}</span> {message.heartCount}</button> : null}
            {editable ? <button type="button" onClick={onEdit}>Edit</button> : null}
            {removable ? <button type="button" onClick={onArchive}>Remove</button> : null}
          </div>
        </div>
      </article>
    </>
  );
}, (previous, next) => previous.message === next.message
  && previous.floatIndex === next.floatIndex
  && previous.showSender === next.showSender
  && previous.unread === next.unread);
