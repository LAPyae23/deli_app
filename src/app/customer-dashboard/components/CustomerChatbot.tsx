'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';

const SUGGESTIONS = [
  'Mohinga near Insein',
  'What is good in Bahan?',
  'Cheap Burmese lunch',
];

function messageText(message: {
  parts?: Array<{ type: string; text?: string }>;
  content?: string;
}) {
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }
  if (!Array.isArray(message.parts)) return '';
  return message.parts
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('');
}

function ChatWindow({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const chatOptions = useMemo(() => {
    try {
      if (typeof DefaultChatTransport === 'function') {
        return { transport: new DefaultChatTransport({ api: '/api/chat' }) };
      }
    } catch {
      // fall through to legacy api option
    }
    return { api: '/api/chat' };
  }, []);

  const { messages, sendMessage, status, error, stop } = useChat(chatOptions as never);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    const text = input.trim();
    if (!text || isLoading) return;
    if (typeof sendMessage === 'function') {
      void sendMessage({ text });
    }
    setInput('');
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const visibleMessages = (Array.isArray(messages) ? messages : []).filter((message) => {
    const text = messageText(message);
    return text.trim().length > 0 || message.role === 'assistant';
  });

  return (
    <section
      className="pointer-events-auto flex h-[min(32rem,calc(100vh-10rem))] w-[min(calc(100vw-1.5rem),24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/15"
      role="dialog"
      aria-label="FoodDash Assistant"
    >
      <header className="flex items-center justify-between gap-3 bg-customer px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">FoodDash Assistant</p>
            <p className="text-[11px] font-medium text-white/80">Menu help from live restaurants</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 px-3 py-3">
        {visibleMessages.length === 0 && (
          <div className="rounded-2xl border border-border bg-background px-3.5 py-3">
            <div className="mb-2 flex items-center gap-2 text-customer">
              <Bot className="h-4 w-4" />
              <p className="text-sm font-semibold text-foreground">Ask for dishes on FoodDash</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              I only recommend restaurants and menu items that are listed in the app.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    if (typeof sendMessage === 'function') {
                      void sendMessage({ text: suggestion });
                    }
                  }}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:border-customer/40 hover:text-customer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((message) => {
          const isUser = message.role === 'user';
          const text = messageText(message);
          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isUser
                    ? 'rounded-br-md bg-customer text-white'
                    : 'rounded-bl-md border border-border bg-background text-foreground'
                }`}
              >
                {text || (isLoading && !isUser ? '…' : '')}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <p className="px-1 text-[11px] font-medium text-muted-foreground">Assistant is typing…</p>
        )}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error.message || 'Could not reach the assistant. Try again.'}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border bg-background p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            rows={1}
            placeholder="Ask about food on FoodDash…"
            className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none ring-customer/20 placeholder:text-muted-foreground focus:border-customer/40 focus:bg-background focus:ring-2"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop?.()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted"
              aria-label="Stop generating"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-customer text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default function CustomerChatbot() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 md:bottom-6">
      {open ? <ChatWindow onClose={() => setOpen(false)} /> : null}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-customer text-white shadow-lg shadow-orange-500/30 ring-4 ring-white transition hover:scale-105 active:scale-95"
        aria-label={open ? 'Close FoodDash Assistant' : 'Open FoodDash Assistant'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
