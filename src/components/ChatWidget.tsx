'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useNotificationSound } from '@/hooks/useNotificationSound';

type ChatMessage = {
  _id?: string;
  orderId?: string;
  senderId: string;
  senderRole: string;
  receiverId: string;
  receiverRole: string;
  text: string;
  isRead?: boolean;
  createdAt?: string;
};

interface ChatWidgetProps {
  currentUserId: string;
  currentUserRole: string;
  targetUserId: string;
  targetUserRole: string;
  targetName: string;
  orderId?: string;
  /** Controlled open state (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Messenger-style chips above the input — click sends instantly */
  quickReplies?: string[];
  /** Hide the floating launcher (use when opened from an external button) */
  showLauncher?: boolean;
  /** Header / bubble accent classes (defaults to customer red) */
  accentClassName?: string;
  launcherClassName?: string;
}

const POLL_MS = 5_000;

export default function ChatWidget({
  currentUserId,
  currentUserRole,
  targetUserId,
  targetUserRole,
  targetName,
  orderId,
  open,
  onOpenChange,
  quickReplies,
  showLauncher = true,
  accentClassName = 'bg-customer',
  launcherClassName,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevMessageCount = useRef(0);
  const playNotification = useNotificationSound();

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setInternalOpen(next);
  };

  const canChat = Boolean(currentUserId && targetUserId);

  const fetchMessages = useCallback(async () => {
    if (!canChat) return;

    try {
      const params = new URLSearchParams({
        senderId: currentUserId,
        receiverId: targetUserId,
      });
      if (orderId) params.set('orderId', orderId);

      const res = await fetch(`/api/messages?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) return;

      const nextMessages: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
      if (
        prevMessageCount.current > 0 &&
        nextMessages.length > prevMessageCount.current
      ) {
        const last = nextMessages[nextMessages.length - 1];
        if (last && last.senderId !== currentUserId) {
          playNotification();
        }
      }
      prevMessageCount.current = nextMessages.length;
      setMessages(nextMessages);
    } catch (error) {
      console.warn('Failed to load messages', error);
    }
  }, [canChat, currentUserId, targetUserId, orderId, playNotification]);

  useEffect(() => {
    prevMessageCount.current = 0;
  }, [currentUserId, targetUserId, orderId]);

  useEffect(() => {
    if (!isOpen || !canChat) return;

    void fetchMessages();
    const interval = setInterval(() => {
      void fetchMessages();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [isOpen, canChat, fetchMessages]);

  useEffect(() => {
    if (!isOpen) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessageText = async (raw: string) => {
    const text = raw.trim();
    if (!text || !canChat || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId || undefined,
          senderId: currentUserId,
          senderRole: currentUserRole,
          receiverId: targetUserId,
          receiverRole: targetUserRole,
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send');
      }

      setInputText('');
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChatMessage]);
      } else {
        await fetchMessages();
      }
    } catch (error) {
      console.warn(error);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageText(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!canChat) return null;

  const replies = Array.isArray(quickReplies)
    ? quickReplies.filter((r) => Boolean(r?.trim()))
    : [];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen && (
        <div className="flex h-[420px] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
          <div
            className={`flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-white ${accentClassName}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{targetName || 'Chat'}</p>
              <p className="truncate text-[11px] text-white/80">
                {targetUserRole}
                {orderId ? ` · Order chat` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 opacity-40" />
                <p className="text-xs font-medium">No messages yet</p>
                <p className="text-[11px]">
                  {replies.length > 0
                    ? 'Pick a quick reply or type a message.'
                    : 'Say hello to start the conversation.'}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg._id || `${msg.senderId}-${msg.createdAt}-${msg.text}`}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        isMine
                          ? `rounded-br-md text-white ${accentClassName}`
                          : 'rounded-bl-md border border-border bg-card text-foreground'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      {msg.createdAt && (
                        <p
                          className={`mt-1 text-[10px] ${
                            isMine ? 'text-white/70' : 'text-muted-foreground'
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {replies.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-border/60 bg-muted/40 px-3 py-2.5 scrollbar-hide">
              {replies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  disabled={isSending}
                  onClick={() => void sendMessageText(reply)}
                  className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] disabled:opacity-50"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border bg-card p-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="input-field flex-1 py-2 text-sm"
              disabled={isSending}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!inputText.trim() || isSending}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${accentClassName}`}
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {showLauncher && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${
            launcherClassName ||
            (isOpen ? 'bg-muted text-foreground' : `${accentClassName} text-white`)
          }`}
          aria-label={isOpen ? 'Close chat' : `Chat with ${targetName}`}
        >
          {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
      )}
    </div>
  );
}
