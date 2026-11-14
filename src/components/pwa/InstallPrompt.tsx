"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "jadeadorn.install.dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Chromium browsers fire `beforeinstallprompt`, so we show our own Install button.
 * iOS Safari has no install API; we show an "Add to Home Screen" hint instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    setHidden(false);
    if (isIosSafari()) setShowIosHint(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  if (hidden || (!deferred && !showIosHint)) return null;

  return (
    <div
      data-testid="install-prompt"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 border border-line bg-paper p-3 shadow-lg sm:inset-x-auto sm:right-5 sm:bottom-5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10" />
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
        <strong className="block font-serif text-sm text-ink">Install JadeAdorn</strong>
        {deferred ? (
          "Add the shop to your home screen for quick, app-like access."
        ) : (
          <>
            In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.
          </>
        )}
      </div>
      {deferred && (
        <button
          type="button"
          className="btn-primary px-4"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
        >
          Install
        </button>
      )}
      <button type="button" aria-label="Dismiss install prompt" onClick={dismiss} className="min-h-11 px-2 text-xl text-muted">
        ×
      </button>
    </div>
  );
}
