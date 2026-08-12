'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Bike,
  Store,
  Phone,
  Mail,
  BadgeCheck,
  IdCard,
} from 'lucide-react';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { SUPPORT_ADMIN_ID } from '@/lib/support';

const ADMIN_ID = SUPPORT_ADMIN_ID;
const CONVERSATIONS_POLL_MS = 10_000;
const CHAT_POLL_MS = 5_000;

type RoleFilter = 'ALL' | 'CUSTOMER' | 'RIDER' | 'RESTAURANT';

type Conversation = {
  contactId: string;
  contactName: string;
  contactRole: string;
  lastMessageText: string;
  updatedAt: string;
};

type ChatMessage = {
  _id?: string;
  senderId: string;
  senderRole?: string;
  receiverId: string;
  text: string;
  createdAt?: string;
};

type ContactProfile = {
  id: string;
  displayId?: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  address?: string;
  township?: string;
  vehicleType?: string;
  status?: string;
  storeStatus?: string;
};

const ROLE_META: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  CUSTOMER: {
    label: 'Customer',
    className: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
    icon: User,
  },
  RIDER: {
    label: 'Rider',
    className: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
    icon: Bike,
  },
  RESTAURANT: {
    label: 'Restaurant',
    className: 'bg-sky-500/15 text-sky-600 border-sky-500/20',
    icon: Store,
  },
};

const FILTER_TABS: { key: RoleFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CUSTOMER', label: 'Customer' },
  { key: 'RIDER', label: 'Rider' },
  { key: 'RESTAURANT', label: 'Restaurant' },
];

function formatTime(value?: string) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function AdminInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [activeContact, setActiveContact] = useState<Conversation | null>(null);
  const [contactProfile, setContactProfile] = useState<ContactProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevMessageCount = useRef(0);
  const playNotification = useNotificationSound();

  const filteredConversations = useMemo(() => {
    if (roleFilter === 'ALL') return conversations;
    return conversations.filter(
      (c) => String(c.contactRole || '').toUpperCase() === roleFilter
    );
  }, [conversations, roleFilter]);

  const loadConversations = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoadingConversations(true);
    try {
      const res = await fetch('/api/admin/messages');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
      const list = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(list);

      setActiveContact((prev) => {
        if (!prev) return prev;
        return list.find((c: Conversation) => c.contactId === prev.contactId) || prev;
      });
    } catch (error) {
      console.error('Failed to load admin conversations', error);
    } finally {
      if (showSpinner) setIsLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (contactId: string, showSpinner = false) => {
      if (showSpinner) setIsLoadingMessages(true);
      try {
        const params = new URLSearchParams({
          senderId: ADMIN_ID,
          receiverId: contactId,
        });
        const res = await fetch(`/api/messages?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load chat');

        const nextMessages: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
        if (
          prevMessageCount.current > 0 &&
          nextMessages.length > prevMessageCount.current
        ) {
          const last = nextMessages[nextMessages.length - 1];
          if (last && last.senderId !== ADMIN_ID) {
            playNotification();
          }
        }
        prevMessageCount.current = nextMessages.length;
        setMessages(nextMessages);
      } catch (error) {
        console.error('Failed to load admin chat', error);
      } finally {
        if (showSpinner) setIsLoadingMessages(false);
      }
    },
    [playNotification]
  );

  const loadContactProfile = useCallback(async (contactId: string) => {
    setProfileLoading(true);
    setContactProfile(null);
    try {
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(contactId)}`);
      const data = await res.json();
      if (res.ok && data.success && data.contact) {
        setContactProfile(data.contact as ContactProfile);
      }
    } catch (error) {
      console.warn('Failed to load contact profile', error);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations(true);
    const interval = setInterval(() => void loadConversations(false), CONVERSATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeContact) {
      setMessages([]);
      setContactProfile(null);
      prevMessageCount.current = 0;
      return;
    }
    prevMessageCount.current = 0;
    void loadMessages(activeContact.contactId, true);
    void loadContactProfile(activeContact.contactId);
    const interval = setInterval(
      () => void loadMessages(activeContact.contactId, false),
      CHAT_POLL_MS
    );
    return () => clearInterval(interval);
  }, [activeContact?.contactId, loadMessages, loadContactProfile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // If filter hides the active conversation, clear selection
    if (
      activeContact &&
      roleFilter !== 'ALL' &&
      String(activeContact.contactRole).toUpperCase() !== roleFilter
    ) {
      setActiveContact(null);
    }
  }, [roleFilter, activeContact]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !activeContact || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: ADMIN_ID,
          senderRole: 'ADMIN',
          receiverId: activeContact.contactId,
          receiverRole: activeContact.contactRole,
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Send failed');

      setInputText('');
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChatMessage]);
      } else {
        await loadMessages(activeContact.contactId, false);
      }
      await loadConversations(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Contacts list */}
      <aside className="flex w-full max-w-xs flex-col border-r border-border bg-card sm:w-80 lg:max-w-sm">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-admin" />
            <h2 className="text-sm font-bold text-foreground">Inbox</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Support chats from customers, riders & restaurants
          </p>

          <div className="mt-3 flex gap-1 overflow-x-auto scrollbar-hide">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === 'ALL'
                  ? conversations.length
                  : conversations.filter(
                      (c) => String(c.contactRole).toUpperCase() === tab.key
                    ).length;
              const active = roleFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRoleFilter(tab.key)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    active
                      ? 'bg-admin text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1 tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {isLoadingConversations ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-admin" />
              <p className="text-xs font-medium">Loading conversations…</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                No conversations
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {roleFilter === 'ALL'
                  ? 'Messages involving Admin will appear here.'
                  : `No ${roleFilter.toLowerCase()} threads yet.`}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredConversations.map((conv) => {
                const meta = ROLE_META[conv.contactRole] || ROLE_META.CUSTOMER;
                const RoleIcon = meta.icon;
                const isActive = activeContact?.contactId === conv.contactId;

                return (
                  <li key={conv.contactId}>
                    <button
                      type="button"
                      onClick={() => setActiveContact(conv)}
                      className={`w-full px-4 py-3.5 text-left transition-colors ${
                        isActive ? 'bg-admin/10' : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {conv.contactName}
                          </p>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </div>
                        <span className="shrink-0 text-[10px] font-tabular text-muted-foreground">
                          {formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {conv.lastMessageText || '—'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Chat window */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        {!activeContact ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-bold text-foreground">Select a conversation</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choose a contact from the inbox to start messaging. Riders can also reach Support
              from their settings.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {activeContact.contactName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(ROLE_META[activeContact.contactRole] || ROLE_META.CUSTOMER).label}
                  {' · '}
                  <span className="font-tabular">{activeContact.contactId.slice(-8)}</span>
                </p>
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6 scrollbar-hide">
                  {isLoadingMessages ? (
                    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-admin" />
                      <span className="text-sm">Loading messages…</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                      <p className="text-sm font-medium">No messages yet</p>
                      <p className="mt-1 text-xs">Send the first message to this contact.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin =
                        msg.senderId === ADMIN_ID || msg.senderRole === 'ADMIN';
                      return (
                        <div
                          key={msg._id || `${msg.senderId}-${msg.createdAt}-${msg.text}`}
                          className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                              isAdmin
                                ? 'rounded-br-md bg-admin text-primary-foreground'
                                : 'rounded-bl-md border border-border bg-card text-foreground'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            {msg.createdAt && (
                              <p
                                className={`mt-1 text-[10px] ${
                                  isAdmin
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
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

                <div className="sticky bottom-0 border-t border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder={`Message ${activeContact.contactName}…`}
                      className="flex-1 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-admin"
                      disabled={isSending}
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={!inputText.trim() || isSending}
                      className="flex h-11 items-center gap-2 rounded-xl bg-admin px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send
                    </button>
                  </div>
                </div>
              </div>

              {/* Contact profile sidebar */}
              <aside className="hidden w-64 shrink-0 flex-col border-l border-border bg-card xl:flex">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Contact info
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {profileLoading ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-admin" />
                      <p className="text-xs">Loading profile…</p>
                    </div>
                  ) : contactProfile ? (
                    <div className="space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-admin/10 text-admin">
                        {React.createElement(
                          (ROLE_META[contactProfile.role] || ROLE_META.CUSTOMER).icon,
                          { className: 'h-5 w-5' }
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{contactProfile.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-admin">
                          {(ROLE_META[contactProfile.role] || ROLE_META.CUSTOMER).label}
                        </p>
                      </div>
                      <dl className="space-y-3 text-xs">
                        <div className="flex items-start gap-2">
                          <IdCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">ID</dt>
                            <dd className="break-all font-mono font-semibold text-foreground">
                              {contactProfile.displayId || contactProfile.id.slice(-10)}
                            </dd>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div>
                            <dt className="text-muted-foreground">Phone</dt>
                            <dd className="font-semibold text-foreground">{contactProfile.phone}</dd>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">Email</dt>
                            <dd className="break-all font-semibold text-foreground">
                              {contactProfile.email}
                            </dd>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div>
                            <dt className="text-muted-foreground">Role</dt>
                            <dd className="font-semibold text-foreground">{contactProfile.role}</dd>
                          </div>
                        </div>
                        {contactProfile.township ? (
                          <div>
                            <dt className="text-muted-foreground">Township</dt>
                            <dd className="font-semibold text-foreground">
                              {contactProfile.township}
                            </dd>
                          </div>
                        ) : null}
                        {contactProfile.vehicleType ? (
                          <div>
                            <dt className="text-muted-foreground">Vehicle</dt>
                            <dd className="font-semibold text-foreground">
                              {contactProfile.vehicleType}
                              {contactProfile.status ? ` · ${contactProfile.status}` : ''}
                            </dd>
                          </div>
                        ) : null}
                        {contactProfile.address ? (
                          <div>
                            <dt className="text-muted-foreground">Address</dt>
                            <dd className="font-semibold text-foreground">
                              {contactProfile.address}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      Profile details unavailable
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
