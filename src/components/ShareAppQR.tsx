'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Smartphone } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

const LOGO_SRC = '/assets/images/app_logo.png';
const QR_SIZE = 184;
const LOGO_SIZE = 40;

type ShareAppQRProps = {
  className?: string;
  variant?: 'light' | 'dark';
};

export default function ShareAppQR({
  className = '',
  variant = 'light',
}: ShareAppQRProps) {
  const [appUrl, setAppUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAppUrl(`${window.location.origin}/customer-dashboard`);
  }, []);

  async function copyUrl() {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const dark = variant === 'dark';

  return (
    <div
      className={`rounded-2xl border p-5 ${
        dark
          ? 'border-white/15 bg-white/10 text-white'
          : 'border-border bg-card text-foreground'
      } ${className}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <Smartphone className={`h-4 w-4 ${dark ? 'text-primary' : 'text-customer'}`} />
        <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-foreground'}`}>
          Scan to Order Food
        </h3>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative rounded-2xl bg-white p-3 shadow-sm">
          {appUrl ? (
            <QRCodeSVG
              value={appUrl}
              size={QR_SIZE}
              level="H"
              bgColor="#ffffff"
              fgColor="#111827"
              title="Scan to open FoodDash"
              imageSettings={{
                src: LOGO_SRC,
                height: LOGO_SIZE,
                width: LOGO_SIZE,
                excavate: true,
              }}
            />
          ) : (
            <div
              className="animate-pulse rounded-lg bg-neutral-100"
              style={{ width: QR_SIZE, height: QR_SIZE }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-2 ring-white">
              <AppLogo size={28} />
            </div>
          </div>
        </div>

        <p
          className={`mt-3 text-center text-xs ${
            dark ? 'text-white/60' : 'text-muted-foreground'
          }`}
        >
          Point your camera at the code to open FoodDash
        </p>

        {appUrl ? (
          <button
            type="button"
            onClick={copyUrl}
            className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              dark
                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title="Copy app URL"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate font-tabular">{appUrl}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
