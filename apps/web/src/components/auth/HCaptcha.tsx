'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * hCaptcha widget wrapper.
 *
 * Renders the hCaptcha challenge widget and calls `onVerify` with the
 * response token once the user completes the challenge. Calls `onExpire`
 * when the token expires so the parent can clear it.
 *
 * Set NEXT_PUBLIC_HCAPTCHA_SITE_KEY in your .env.local.
 * Set NEXT_PUBLIC_HCAPTCHA_ENABLED=false to skip rendering in development.
 */

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    _hcaptchaOnLoad?: () => void;
  }
}

interface HCaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export function HCaptcha({ onVerify, onExpire }: HCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const enabled = process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED !== 'false';

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.hcaptcha || !siteKey) return;
    if (widgetIdRef.current !== null) return; // already rendered

    widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerify(token),
      'expired-callback': () => {
        onExpire?.();
      },
    });
  }, [siteKey, onVerify, onExpire]);

  useEffect(() => {
    if (!enabled || !siteKey) return;

    // If the hCaptcha script is already loaded, render immediately
    if (window.hcaptcha) {
      renderWidget();
      return;
    }

    // Otherwise load the script and render on load
    window._hcaptchaOnLoad = renderWidget;

    const existingScript = document.querySelector('script[src*="hcaptcha.com/1/api.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=_hcaptchaOnLoad&render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current !== null && window.hcaptcha) {
        try {
          window.hcaptcha.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [enabled, siteKey, renderWidget]);

  // Dev bypass — show a notice instead of the widget
  if (!enabled || !siteKey) {
    return (
      <div className="text-xs text-gray-400 border border-dashed border-gray-300 rounded px-3 py-2">
        CAPTCHA disabled in development
      </div>
    );
  }

  return <div ref={containerRef} className="h-captcha" />;
}
