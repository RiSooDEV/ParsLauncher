import { QueryClientProvider } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { DownloadsListener } from "./components/blocks/downloads/downloads-listener";
import { ParsUpdateListener } from "./components/pars/update-listener";
import { StartupUpdater } from "./components/blocks/updater/startup-updater";
import { AuthModal } from "./components/blocks/auth/auth-modal";
import { ParsProfileMenu } from "./components/blocks/auth/profile-menu";
import { TopNav } from "./components/nav-menu";
import { TopProfileSwitcher } from "./components/nav-profile";
import { useAccountStore } from "./stores/account";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { useBackend, useBackendMutation } from "./hooks/use-backend";
import { queryClient } from "./lib/query-client";

import { useLocale } from "./stores/locale";

/**
 * OuterLayout — installs all the React context providers (Theme,
 * QueryClient, Toaster). This component itself does NOT call any hook
 * that depends on those providers, so it's safe to use as the router's
 * root element.
 *
 * The providers wrap <InnerLayout />, which is allowed to call
 * useBackend / useBackendMutation because by then QueryClientProvider
 * is already mounted.
 */
export default function Layout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <InnerLayout />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/**
 * InnerLayout — Pars Launcher's own chrome: a top navigation bar
 * (brand → nav pills → profile switchers → window controls) instead of
 * the side-rail layout the upstream fork inherited. All useBackend /
 * useBackendMutation / Tauri window calls live here.
 */
function InnerLayout() {
  const { locale } = useLocale();
  const isRtl = locale === "fa";
  const tauriWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  const { data: backendMaximized } = useBackend({
    name: "pars_is_maximized",
  });
  const { mutateAsync: toggleMaximized } = useBackendMutation({
    name: "pars_toggle_maximized",
  });

  useEffect(() => {
    if (backendMaximized !== undefined) {
      setIsMaximized(backendMaximized);
    }
  }, [backendMaximized]);

  useEffect(() => {
    const unlisten = tauriWindow.onResized(() => {
      invoke<boolean>("pars_is_maximized")
        .then(setIsMaximized)
        .catch(() => undefined);
    });
    return () => {
      unlisten.then((stopListening) => stopListening());
    };
  }, [tauriWindow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleMaximized()
          .then(setIsMaximized)
          .catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMaximized]);

  useEffect(() => {
    useAccountStore.getState().fetchUser();
  }, []);

  const handleToggleMaximized = async () => {
    const next = await toggleMaximized();
    setIsMaximized(next);
  };

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-background antialiased"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <StartupUpdater />
      <AuthModal />
      <ParsUpdateListener />
      <DownloadsListener />

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header
        className="relative z-20 flex h-12 shrink-0 select-none items-center gap-2 border-border/50 border-b bg-sidebar/90 px-3 shadow-[0_1px_0_rgba(45,212,196,0.06)] backdrop-blur-xl"
        data-tauri-drag-region
      >
        {/* Brand mark */}
        <div
          className="flex shrink-0 items-center gap-2"
          data-tauri-drag-region="false"
        >
          <img
            alt="Pars Launcher"
            className="size-7"
            height={28}
            src="/icon.png"
            width={28}
          />
          <div className="hidden leading-none sm:block">
            <div className="font-black text-[13px] tracking-wide">
              Pars Launcher
            </div>
            <div className="mt-0.5 font-medium text-[9px] text-primary/80 uppercase tracking-[0.18em]">
              MethoriaCraft
            </div>
          </div>
        </div>

        {/* Compact navigation fallback for narrow windows */}
        <div className="flex shrink-0 md:hidden" data-tauri-drag-region="false">
          <TopNav />
        </div>

        {/* Centered navigation pills */}
        <div
          className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex"
          data-tauri-drag-region="false"
        >
          <TopNav />
        </div>

        <div className="h-full flex-1" data-tauri-drag-region />

        {/* Profile switchers */}
        <div
          className="flex shrink-0 items-center gap-2"
          data-tauri-drag-region="false"
        >
          <TopProfileSwitcher />
          <ParsProfileMenu />
        </div>

        {/* Window controls (keep LTR order like native Windows) */}
        <div
          className="flex shrink-0 select-none items-stretch ltr:ms-1 rtl:me-1"
          data-tauri-drag-region="false"
          dir="ltr"
        >
          <button
            aria-label="Minimize"
            className="flex h-12 w-10 items-center justify-center text-muted-foreground/70 transition-colors hover:bg-white/[0.08] hover:text-foreground active:bg-white/[0.14]"
            onClick={() => tauriWindow.minimize()}
            title="Minimize"
            type="button"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            aria-label={
              isMaximized ? "Restore window (F11)" : "Maximize window (F11)"
            }
            className="flex h-12 w-10 items-center justify-center text-muted-foreground/70 transition-colors hover:bg-white/[0.08] hover:text-foreground active:bg-white/[0.14]"
            onClick={handleToggleMaximized}
            title={isMaximized ? "Restore window (F11)" : "Maximize window (F11)"}
            type="button"
          >
            {isMaximized ? (
              <Copy className="size-3 rotate-180 -scale-y-100" />
            ) : (
              <Square className="size-3" />
            )}
          </button>
          <button
            aria-label="Close"
            className="flex h-12 w-10 items-center justify-center text-muted-foreground/70 transition-colors hover:bg-[#e81123] hover:text-white active:bg-[#bf0f1d] active:text-white"
            onClick={() => tauriWindow.close()}
            title="Close"
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
