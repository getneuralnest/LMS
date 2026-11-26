"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileOptions = {
  sitekey: string;
  callback(token: string): void;
  "expired-callback"(): void;
  "error-callback"(): void;
};

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: TurnstileOptions): string;
      reset(widgetId: string): void;
    };
  }
}

export function TurnstileField({
  siteKey,
  name,
  resetKey,
  onToken,
  token,
}: {
  siteKey: string;
  name: string;
  resetKey: object;
  onToken(token: string): void;
  token: string;
}) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scriptLoaded || !window.turnstile || !containerRef.current || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
  }, [onToken, scriptLoaded, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      onToken("");
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [onToken, resetKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} aria-label="CAPTCHA" />
      <input type="hidden" name={name} value={token} />
    </>
  );
}
