import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, RefreshIcon, ServerIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ServerEntryRemote, ServerStatusPayload } from "@/invokes";
import { backend } from "@/lib/utils";
import { useConfig } from "@/stores/config";
import { useLocale } from "@/stores/locale";
import { cn } from "@/lib/utils";

type PingState =
  | { kind: "loading" }
  | { kind: "online"; status: ServerStatusPayload }
  | { kind: "offline"; reason: string };

function latencyColor(latency: number): string {
  if (latency < 100) return "bg-emerald-500";
  if (latency < 300) return "bg-amber-500";
  return "bg-red-500";
}

function latencyText(latency: number, isFa: boolean): string {
  return isFa ? `${latency} میلی‌ثانیه` : `${latency} ms`;
}

export default function Servers() {
  const { locale } = useLocale();
  const isFa = locale === "fa";
  const version = useConfig((state) => state.version);

  const [entries, setEntries] = useState<ServerEntryRemote[] | null>(null);
  const [pings, setPings] = useState<Record<string, PingState>>({});
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await backend("servers_builtin_list");
    setEntries(list);
    const next: Record<string, PingState> = {};
    for (const entry of list) {
      next[entry.id] = { kind: "loading" };
    }
    setPings(next);
    await Promise.allSettled(
      list.map(async (entry) => {
        try {
          const status = await backend("servers_ping", {
            host: entry.host,
            port: entry.port,
          });
          setPings((prev) => ({
            ...prev,
            [entry.id]: { kind: "online", status },
          }));
        } catch (reason) {
          setPings((prev) => ({
            ...prev,
            [entry.id]: {
              kind: "offline",
              reason: typeof reason === "string" ? reason : "ping failed",
            },
          }));
        }
      })
    );
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      toast.error(isFa ? "خطا در دریافت لیست سرورها" : "Failed to load server list");
    });
  }, [refresh, isFa]);

  const handleJoin = async (entry: ServerEntryRemote) => {
    if (!version) {
      toast.error(
        isFa
          ? "اول از صفحه دانلودها یک نسخه نصب کن، بعد سرور رو اجرا کن"
          : "Install a version from the Downloads page first, then join a server"
      );
      return;
    }
    setJoiningId(entry.id);
    toast.info(
      isFa
        ? `در حال ورود به ${entry.name} (${entry.host}:${entry.port})...`
        : `Joining ${entry.name} (${entry.host}:${entry.port})...`
    );
    try {
      await backend("play", {
        directConnect: { server: entry.host, port: entry.port },
        selectedVersion: version,
      });
    } catch (err) {
      toast.error(
        isFa
          ? `اجرا نشد — احتمالاً نسخه ${version} کامل نصب نیست. از صفحه دانلودها رپیرش کن.`
          : `Launch failed — version ${version} may be incomplete. Repair it from Downloads.`
      );
      console.warn("direct connect failed", err);
    } finally {
      setJoiningId(null);
    }
  };

  const sorted = entries
    ? [...entries].sort((a, b) => Number(b.featured) - Number(a.featured))
    : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ServerIcon} className="size-5 text-primary" />
          <h1 className="text-lg font-bold">
            {isFa ? "سرورها" : "Servers"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() =>
            refresh().catch(() => {
              toast.error(
                isFa ? "خطا در دریافت لیست سرورها" : "Failed to refresh server list"
              );
            })
          }
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-secondary/60 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          <HugeiconsIcon icon={RefreshIcon} className="size-4" />
          {isFa ? "به‌روزرسانی" : "Refresh"}
        </button>
      </div>

      {!sorted ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {isFa ? "در حال دریافت لیست سرورها..." : "Loading server list..."}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
          {sorted.map((entry) => (
            <ServerCard
              key={entry.id}
              entry={entry}
              isFa={isFa}
              ping={pings[entry.id] ?? { kind: "loading" }}
              canJoin={version !== null}
              joining={joiningId === entry.id}
              onJoin={() => handleJoin(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServerCard({
  entry,
  isFa,
  ping,
  canJoin,
  joining,
  onJoin,
}: {
  entry: ServerEntryRemote;
  isFa: boolean;
  ping: PingState;
  canJoin: boolean;
  joining: boolean;
  onJoin: () => void;
}) {
  const description = isFa ? entry.description_fa : entry.description_en;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border bg-secondary/40 p-4 transition-colors",
        entry.featured
          ? "border-primary/40 bg-primary/10 shadow-[0_2px_24px_rgba(36,132,236,0.15)]"
          : "border-white/5 hover:bg-secondary/60"
      )}
    >
      <ServerIcon64 ping={ping} featured={entry.featured} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{entry.name}</span>
          {entry.featured && (
            <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[10px] font-black tracking-wide text-primary uppercase">
              {isFa ? "سرور ما" : "Our server"}
            </span>
          )}
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
            {entry.versions}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {entry.host}:{entry.port}
          </span>
        </div>

        <p className="mt-1 truncate text-sm text-muted-foreground">
          {ping.kind === "online" && ping.status.motd
            ? ping.status.motd
            : description}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <PingSummary ping={ping} isFa={isFa} />
        </div>
      </div>

      <button
        type="button"
        onClick={onJoin}
        disabled={joining || !canJoin}
        className={cn(
          "shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition-all active:scale-[0.98]",
          joining || !canJoin
            ? "cursor-not-allowed bg-secondary/60 text-muted-foreground"
            : "bg-emerald-600 text-white hover:bg-emerald-500"
        )}
        title={
          canJoin
            ? undefined
            : isFa
              ? "اول یک نسخه نصب کن"
              : "Install a version first"
        }
      >
        {joining
          ? isFa
            ? "در حال اجرا..."
            : "Launching..."
          : isFa
            ? "ورود"
            : "Join"}
      </button>
    </div>
  );
}

function ServerIcon64({
  ping,
  featured,
}: {
  ping: PingState;
  featured: boolean;
}) {
  if (ping.kind === "online" && ping.status.favicon) {
    return (
      <img
        src={ping.status.favicon}
        alt=""
        className="size-12 shrink-0 rounded-lg"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-lg",
        featured ? "bg-primary/25 text-primary" : "bg-white/5 text-muted-foreground"
      )}
    >
      <HugeiconsIcon icon={Globe02Icon} className="size-6" />
    </div>
  );
}

function PingSummary({ ping, isFa }: { ping: PingState; isFa: boolean }) {
  if (ping.kind === "loading") {
    return (
      <span className="text-muted-foreground">
        {isFa ? "در حال پینگ..." : "Pinging..."}
      </span>
    );
  }
  if (ping.kind === "offline") {
    return (
      <span className="flex items-center gap-1.5 text-red-400">
        <span className="size-2 rounded-full bg-red-500" />
        {isFa ? "آفلاین" : "Offline"}
      </span>
    );
  }
  const { status } = ping;
  return (
    <>
      <span className="flex items-center gap-1.5 font-medium">
        <span className={cn("size-2 rounded-full", latencyColor(status.latency_ms))} />
        {latencyText(status.latency_ms, isFa)}
      </span>
      <span className="text-muted-foreground">
        {isFa ? "بازیکنان:" : "Players:"}{" "}
        <span className="font-semibold text-foreground">
          {status.players_online}/{status.players_max}
        </span>
      </span>
      <span className="text-muted-foreground">
        {status.version_name}
      </span>
    </>
  );
}
