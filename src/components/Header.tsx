"use client";

import { useEffect, useState } from "react";
import { formatDate, getGreeting } from "@/lib/utils";

export function Header() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  return (
    <header className="flex items-start justify-between pt-6">
      <div>
        <p className="text-sm font-medium text-muted">{formatDate()}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {getGreeting()} 👋
        </h1>
        <p className="mt-1 text-sm text-muted">Organize seu dia com foco</p>
      </div>
      
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          className="mt-1 flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Instalar App
        </button>
      )}
    </header>
  );
}
