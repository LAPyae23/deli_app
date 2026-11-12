'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { formatKyat } from '@/lib/currency';

type Result = {
  restaurant: { id: string; name: string } | null;
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number; image: string; heard: string }>;
  unmatched: string[];
  message?: string;
};

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognizer(): SpeechRec | null {
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Event the dashboard listens to, so any component can add items to the cart. */
export const ADD_TO_CART_EVENT = 'fooddash:add-to-cart';

/** Order by voice (Web Speech API) or by typing a sentence; matched dishes go to the cart. */
export default function VoiceOrder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tx, lang } = useT();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [speechLang, setSpeechLang] = useState<'my-MM' | 'en-US'>('en-US');
  const recRef = useRef<SpeechRec | null>(null);
  const supported = typeof window !== 'undefined' && Boolean(getRecognizer());

  useEffect(() => setSpeechLang(lang === 'my' ? 'my-MM' : 'en-US'), [lang]);
  useEffect(() => {
    if (!open) {
      recRef.current?.stop();
      setListening(false);
    }
  }, [open]);

  if (!open) return null;

  const find = async (sentence = text) => {
    if (!sentence.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/voice-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not understand the order');
      setResult(data as Result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not understand the order');
    } finally {
      setLoading(false);
    }
  };

  const listen = () => {
    const rec = getRecognizer();
    if (!rec) return;
    rec.lang = speechLang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const heard = Array.from(e.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      setText(heard);
      void find(heard);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') toast.error(e.error === 'not-allowed' ? 'Allow microphone access to order by voice' : 'Could not hear you. Try again or type it.');
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    setResult(null);
    rec.start();
  };

  const addAll = () => {
    if (!result?.restaurant || result.items.length === 0) return;
    window.dispatchEvent(
      new CustomEvent(ADD_TO_CART_EVENT, {
        detail: result.items.map((i) => ({
          id: i.id,
          name: i.name,
          options: '',
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          restaurantId: result.restaurant!.id,
          restaurantName: result.restaurant!.name,
          image: i.image,
          imageAlt: i.name,
        })),
      })
    );
    toast.success(`Added ${result.items.reduce((n, i) => n + i.quantity, 0)} item(s) to your cart`);
    setResult(null);
    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{tx('Voice order')}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Say or type your order, e.g. <i>&quot;2 mohinga and a coffee&quot;</i> or <i>&quot;မုန့်ဟင်းခါး နှစ်ပွဲနဲ့ ကော်ဖီ&quot;</i>.
        </p>

        <div className="flex flex-col items-center gap-3">
          {supported ? (
            <>
              <button
                type="button"
                onClick={listening ? () => recRef.current?.stop() : listen}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
                  listening ? 'animate-pulse bg-danger' : 'bg-customer hover:scale-105'
                }`}
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
              <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
                {(['my-MM', 'en-US'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setSpeechLang(l)} className={`rounded-md px-2.5 py-1 font-semibold ${speechLang === l ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                    {l === 'my-MM' ? 'မြန်မာ' : 'English'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">This browser cannot listen. Type your order instead.</p>
          )}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void find();
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="2 mohinga and a coffee" className="input-field min-w-0 flex-1 py-2.5 text-sm" />
          <button type="submit" disabled={loading} className="rounded-xl bg-muted px-4 text-sm font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
          </button>
        </form>

        {result && (
          <div className="mt-4 rounded-2xl border border-border p-3">
            {result.restaurant ? (
              <>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">From {result.restaurant.name}</p>
                <ul className="space-y-1.5 text-sm">
                  {result.items.map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>
                        {i.quantity}× {i.name}
                      </span>
                      <span className="font-tabular">{formatKyat(i.unitPrice * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {result.unmatched.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600">Not found: {result.unmatched.join(', ')}</p>
                )}
                <button type="button" onClick={addAll} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-customer py-2.5 text-sm font-bold text-white">
                  <ShoppingCart className="h-4 w-4" /> Add to cart
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{result.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
