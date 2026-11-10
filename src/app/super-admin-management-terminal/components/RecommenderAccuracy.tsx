'use client';

import React, { useEffect, useState } from 'react';
import { Target, Loader2 } from 'lucide-react';

type EvalPayload = {
  success: boolean;
  method: string;
  customersEvaluated: number;
  trainOrders: number;
  dishCount: number;
  ks: number[];
  results: Array<{ name: string; hitRate: Record<string, number> }>;
  weights: Record<string, number>;
};

const WEIGHT_LABELS: Record<string, string> = {
  collaborative: 'Collaborative filtering',
  category: 'Category affinity',
  repeat: 'Repeat orders',
  popularity: 'Popularity (30 days)',
  price: 'Price fit',
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Offline evaluation of the customer "For You" recommender:
 * hide each customer's latest order, then check whether the model's top-K
 * contains a dish from it (Hit Rate@K), against two baselines.
 */
export default function RecommenderAccuracy() {
  const [data, setData] = useState<EvalPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/recommender-eval')
      .then((r) => r.json())
      .then((j: EvalPayload) => (j.success ? setData(j) : setError(true)))
      .catch(() => setError(true));
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Target className="h-4 w-4 text-admin" />
            <h3 className="text-sm font-bold text-foreground">For You recommender — accuracy</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave-last-order-out test: each customer&apos;s newest order is hidden, the model is
            trained on the rest, and we check if a hidden dish is in the top-K picks.
          </p>
        </div>
        {data && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground font-tabular">{data.customersEvaluated}</span>{' '}
            customers ·{' '}
            <span className="font-semibold text-foreground font-tabular">{data.trainOrders.toLocaleString()}</span>{' '}
            training orders ·{' '}
            <span className="font-semibold text-foreground font-tabular">{data.dishCount}</span> dishes
          </p>
        )}
      </div>

      {error && <p className="text-sm text-muted-foreground">Could not load the evaluation.</p>}
      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-admin" /> Running evaluation…
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {data.ks.map((k) => {
            const hybrid = data.results[0]?.hitRate[k] || 0;
            const popular = data.results.find((r) => r.name === 'Most popular')?.hitRate[k] || 0;
            const lift = popular > 0 ? (hybrid - popular) / popular : 0;
            return (
              <div key={k}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Hit Rate@{k}
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    {lift >= 0 ? '+' : ''}
                    {(lift * 100).toFixed(0)}% vs most popular
                  </span>
                </div>
                <div className="space-y-2" role="list">
                  {data.results.map((r, i) => {
                    const v = r.hitRate[k] || 0;
                    return (
                      <div key={r.name} role="listitem" title={`${r.name}: ${pct(v)} of customers had a hidden dish in the top ${k}`}>
                        <div className="flex justify-between text-xs">
                          <span className={i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                            {r.name}
                          </span>
                          <span className="font-semibold text-foreground font-tabular">{pct(v)}</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-admin' : 'bg-muted-foreground/40'}`}
                            style={{ width: `${v * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Hybrid score weights
            </h4>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(data.weights).map(([key, w]) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="py-1.5 text-foreground">{WEIGHT_LABELS[key] || key}</td>
                    <td className="py-1.5 text-right font-semibold text-foreground font-tabular">
                      {Math.round(w * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">
              New customers without history get the popularity ranking only.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
