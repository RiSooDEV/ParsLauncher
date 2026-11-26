import { Alert01Icon, Download01Icon, Package01Icon, ServerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Check, Pencil, Shirt, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { useBackend, useBackendMutation } from "@/hooks/use-backend";
import type { InstanceSummary, LaunchProgress } from "@/invokes";
import { backend, cn } from "@/lib/utils";
import { errorText } from "@/messages";
import { useConfig } from "@/stores/config";
import { useLocale } from "@/stores/locale";

const WALLPAPER = "/wallpapers/wallpaper.png";

/**
 * Home — Pars Launcher's own dashboard layout (hero play panel + side
 * rail). Structurally distinct from the upstream fork's full-bleed
 * wallpaper + bottom bar: play action front and center, skin preview,
 * stats and quick actions in a side column.
 */
export default function IndexPage() {
  useStartupDirectConnect();

  return (
    <div className="grid h-full min-h-0 animate-fade-up gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <HeroPanel />
      <SideRail />
    </div>
  );
}

/* ── Hero panel ──────────────────────────────────────────────────────── */

function HeroPanel() {
  const { locale } = useLocale();
  const isFa = locale === "fa";

  return (
    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <img
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover object-center opacity-90"
        height={1080}
        src={WALLPAPER}
        width={1920}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/90" />

      <div className="relative z-10 flex flex-1 flex-col justify-between p-6">
        {/* Top badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-black/50 px-3 py-1 font-bold text-[10px] text-primary uppercase tracking-[0.16em] backdrop-blur-md">
            <Sparkles className="size-3" />
            MethoriaCraft
          </span>
          <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 font-semibold text-[10px] text-white/70 uppercase tracking-[0.16em] backdrop-blur-md">
            Offline Ready
          </span>
        </div>

        {/* Center title + play */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4">
          <div className="text-center">
            <h1 className="font-black text-4xl text-white mix-blend-difference [text-shadow:0_2px_14px_rgba(0,0,0,0.6)] xl:text-5xl">
              Pars Launcher
            </h1>
            <p className="mt-2 font-medium text-white/55 text-xs">
              {isFa
                ? "لانچر آفلاین اختصاصی مدوریا کرافت"
                : "The dedicated offline launcher for MethoriaCraft"}
            </p>
          </div>

          <div className="relative w-full max-w-sm">
            <PlayButton />
          </div>
        </div>

        {/* Instance selector strip */}
        <div className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-black/55 p-3 shadow-lg backdrop-blur-xl">
          <span className="font-semibold text-[10px] text-white/50 uppercase tracking-wider">
            Minecraft Instance
          </span>
          <div className="mt-1.5">
            <VersionSelect />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Side rail ───────────────────────────────────────────────────────── */

function SideRail() {
  const { data: profile } = useBackend({
    name: "pars_get_profile",
  });

  const stats = profile?.statistics;

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-1 xl:pb-0">
      <SkinCard />

      <div className="glass rounded-2xl p-4">
        <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
          Your stats
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile
            label={stats ? `${Math.floor(stats.totalPlaytimeSeconds / 3600)}h` : "—"}
            title="Playtime"
          />
          <StatTile
            label={stats ? String(stats.totalSessions) : "—"}
            title="Sessions"
          />
          <StatTile
            label={stats ? String(stats.achievementsUnlocked) : "—"}
            title="Achievements"
          />
        </div>
      </div>

      <QuickLinks />
    </div>
  );
}

function StatTile({ label, title }: { label: string; title: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/30 px-2 py-2.5 text-center">
      <div className="font-black text-lg text-glow">{label}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{title}</div>
    </div>
  );
}

function SkinCard() {
  const navigate = useNavigate();
  const { data: selectedProfile } = useBackend({
    name: "get_selected_profile",
  });

  const [activeSkin, setActiveSkin] = useState<{
    skinUrlOrData: string;
    model: "default" | "slim";
    capeUrl: string | null;
  } | null>(null);

  useEffect(() => {
    invoke<{
      skinUrlOrData: string;
      model: "default" | "slim";
      capeUrl: string | null;
    } | null>("pars_get_active_skin")
      .then(setActiveSkin)
      .catch(() => {});
  }, []);

  const skinUrl = activeSkin?.skinUrlOrData ?? null;
  const model = activeSkin?.model ?? "default";
  const hasCape = Boolean(activeSkin?.capeUrl);
  const username = selectedProfile?.username ?? "Player";

  return (
    <button
      className="glass group flex items-center gap-3 rounded-2xl p-4 text-start transition-transform hover:scale-[1.01]"
      onClick={() => navigate("/skin")}
      title="Open Skin Studio"
      type="button"
    >
      <SkinFace size={56} skinUrl={skinUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-primary uppercase tracking-wider">
          <Shirt className="size-3.5" />
          Skin Studio
        </div>
        <div className="mt-0.5 truncate font-semibold text-sm">{username}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">
            {model === "slim" ? "Slim 3px" : "Classic 4px"}
          </span>
          {hasCape && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
              Cape
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Renders the face area (8,8 → 16,16) of a Minecraft skin texture as a
 * crisp pixel-art canvas. Works for both 64x64 and legacy 64x32 skins.
 */
function SkinFace({ skinUrl, size }: { skinUrl: string | null; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!skinUrl) {
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, canvas.width, canvas.height);
    };
    img.src = skinUrl;
  }, [skinUrl]);

  return (
    <canvas
      className="shrink-0 rounded-xl border border-border/50 bg-secondary/40"
      height={size}
      ref={canvasRef}
      style={{ imageRendering: "pixelated", width: size, height: size }}
      width={size}
    />
  );
}

function QuickLinks() {
  const navigate = useNavigate();

  const links = [
    {
      icon: <HugeiconsIcon icon={ServerIcon} size={18} strokeWidth={2} />,
      title: "Servers",
      url: "/servers",
    },
    {
      icon: <HugeiconsIcon icon={Download01Icon} size={18} strokeWidth={2} />,
      title: "Downloads",
      url: "/downloads",
    },
    {
      icon: <HugeiconsIcon icon={Package01Icon} size={18} strokeWidth={2} />,
      title: "Library",
      url: "/library",
    },
    {
      icon: <HugeiconsIcon icon={Package01Icon} size={18} strokeWidth={2} />,
      title: "Modpacks",
      url: "/modpacks",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {links.map((link) => (
        <button
          className="glass flex items-center gap-2 rounded-xl px-3 py-3 font-semibold text-xs transition-colors hover:bg-white/[0.08]"
          key={link.url}
          onClick={() => navigate(link.url)}
          type="button"
        >
          <span className="text-primary">{link.icon}</span>
          <span>{link.title}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Startup direct connect (unchanged behavior) ─────────────────────── */

/**
 * One-shot startup direct connect: consumed via `startup_direct_connect`.
 * Launched with `--server host[:port]` (or `--server host --port N`), the
 * launcher joins the server as soon as an instance is available.
 */
function useStartupDirectConnect() {
  const { locale } = useLocale();
  const isFa = locale === "fa";

  useEffect(() => {
    backend("startup_direct_connect")
      .then(async (target) => {
        if (!target) {
          return;
        }
        const port = target.port ?? 25565;
        toast.info(
          isFa
            ? `در حال ورود مستقیم به ${target.server}:${port}...`
            : `Connecting directly to ${target.server}:${port}...`
        );

        // The config store may still be loading at mount; give it a few
        // seconds to pick the selected instance before giving up.
        let version: string | null = null;
        for (let i = 0; i < 12; i++) {
          version = useConfig.getState().version;
          if (version) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (!version) {
          toast.error(
            isFa
              ? "هیچ نسخه‌ای انتخاب نشده — اول از دانلودها یک نسخه نصب کن"
              : "No version selected — install one from Downloads first"
          );
          return;
        }
        try {
          await backend("play", {
            directConnect: { server: target.server, port },
            selectedVersion: version,
          });
        } catch (err) {
          toast.error(
            isFa
              ? "اجرا نشد — نسخه انتخاب‌شده ممکن است کامل نصب نباشد"
              : "Launch failed — the selected version may be incomplete"
          );
          console.warn("startup direct connect failed", err);
        }
      })
      .catch(() => {});
    // Intentionally runs once per mount: the target is consumed backend-side.
  }, []); // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot startup hook
}

/* ── Instance selector ───────────────────────────────────────────────── */

function VersionSelect() {
  const { version, setVersion } = useConfig();
  const [isRenaming, setIsRenaming] = useState(false);
  const [customNameInput, setCustomNameInput] = useState("");

  const {
    data: instances,
    error,
    refetch,
  } = useBackend({
    initialData: [],
    initialDataUpdatedAt: 0,
    name: "list_instances",
    queryKey: ["instances"],
  });

  const updateSettings = useBackendMutation({
    name: "update_instance_settings",
  });

  const currentInstance =
    instances?.find((i) => i.id === version) ?? instances?.[0] ?? null;

  useEffect(() => {
    if (instances && instances.length > 0) {
      if (!version || !instances.some((i) => i.id === version)) {
        setVersion(instances[0].id);
      }
    } else if (instances && instances.length === 0 && version) {
      setVersion("");
    }
  }, [instances, version, setVersion]);

  useEffect(() => {
    if (currentInstance) {
      setCustomNameInput(currentInstance.displayName);
    }
  }, [currentInstance?.id, currentInstance?.displayName]);

  const handleSaveRename = async () => {
    if (!currentInstance || !customNameInput.trim()) {
      return;
    }
    try {
      await updateSettings.mutateAsync({
        displayName: customNameInput.trim(),
        instanceId: currentInstance.id,
        ramMaxMb: currentInstance.ramMaxMb ?? null,
        ramMinMb: currentInstance.ramMinMb ?? null,
      });
      await refetch();
      setIsRenaming(false);
      toast.success("Instance renamed successfully");
    } catch {
      toast.error("Failed to rename instance");
    }
  };

  if (error) {
    return (
      <Empty className="h-12 w-full flex-row justify-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-2">
        <HugeiconsIcon
          className="text-destructive"
          icon={Alert01Icon}
          size={20}
        />
        <EmptyTitle className="text-destructive text-sm">
          {errorText(error.code).title}
        </EmptyTitle>
      </Empty>
    );
  }

  if (isRenaming && currentInstance) {
    return (
      <div className="flex h-11 items-center gap-1.5">
        <Input
          autoFocus
          className="h-11 flex-1 rounded-lg border-primary/50 bg-white/10 px-3 text-white text-xs placeholder:text-muted-foreground/60 focus:border-primary shadow-inner"
          onChange={(e) => setCustomNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSaveRename();
            } else if (e.key === "Escape") {
              setIsRenaming(false);
            }
          }}
          placeholder="Custom instance name..."
          value={customNameInput}
        />
        <Button
          className="h-11 rounded-lg bg-emerald-600 px-3 font-semibold text-white text-xs shadow-sm hover:bg-emerald-500"
          disabled={!customNameInput.trim() || updateSettings.isPending}
          onClick={handleSaveRename}
          size="sm"
          type="button"
        >
          <Check className="size-4" />
        </Button>
        <Button
          className="h-11 rounded-lg px-2.5 text-muted-foreground text-xs hover:text-white"
          onClick={() => setIsRenaming(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Combobox
          autoHighlight
          isItemEqualToValue={(a: InstanceSummary | null, b: InstanceSummary | null) => a?.id === b?.id}
          items={instances}
          onValueChange={(selectedInst: InstanceSummary | null) => {
            if (selectedInst) {
              setVersion(selectedInst.id);
            }
          }}
          value={currentInstance}
        >
          <ComboboxInput
            className="h-11 w-full rounded-lg border-white/10 bg-white/5 text-white shadow-inner transition-colors placeholder:text-muted-foreground/60 hover:border-white/20 focus:border-primary/50"
            placeholder="Select an Instance"
            value={currentInstance?.displayName ?? ""}
          />
          <ComboboxContent className="rounded-lg border-white/10 bg-[#161616]/95 text-white shadow-2xl backdrop-blur-xl">
            <ComboboxEmpty className="p-3 text-center text-muted-foreground text-xs">
              No instances found.
            </ComboboxEmpty>
            <ComboboxList>
              {(inst: InstanceSummary) => (
                <ComboboxItem
                  className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-xs transition-colors hover:bg-white/10"
                  key={inst.id}
                  value={inst}
                >
                  <div className="flex min-w-0 flex-col pr-2">
                    <span className="truncate font-semibold text-white text-xs">
                      {inst.displayName}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground/80">
                      {inst.gameVersion} · {inst.loader.toUpperCase()}
                    </span>
                  </div>
                  {inst.id === version && (
                    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-[10px] text-emerald-400">
                      Active
                    </span>
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {currentInstance && (
        <Button
          className="h-11 w-11 shrink-0 rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
          onClick={() => {
            setCustomNameInput(currentInstance.displayName);
            setIsRenaming(true);
          }}
          size="icon"
          title="Rename instance"
          type="button"
          variant="ghost"
        >
          <Pencil className="size-4" />
        </Button>
      )}
    </div>
  );
}

/* ── Play button + launch progress ───────────────────────────────────── */

// Percent at which we consider the launch "almost there".
const LAUNCH_NEAR_THRESHOLD = 80;
// How long the completed bar stays visible after a successful launch.
const LAUNCH_DONE_LINGER_MS = 3000;

function LaunchProgressBar({
  isPending,
  justLaunched,
  progress,
}: {
  isPending: boolean;
  justLaunched: boolean;
  progress: LaunchProgress | null;
}) {
  if (!(isPending || justLaunched)) {
    return null;
  }

  let percent = 100;
  let label = "Game launched";
  if (isPending) {
    percent = progress ? progress.percent : 0;
    label = progress ? progress.phase : "Starting launch...";
  }
  const near = isPending && percent >= LAUNCH_NEAR_THRESHOLD;

  return (
    <div className="absolute inset-x-0 bottom-full mb-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-semibold text-xs drop-shadow">
        <span className="text-gray-300">{label}</span>
        {near ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
            Almost there!
          </span>
        ) : (
          <span className="text-gray-400">{percent}%</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#111]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            near || justLaunched ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function PlayButton() {
  const version = useConfig((state) => state.version);

  // NOTE: the selected profile lives in the backend config (set via the
  // profile menu). Offline profiles are first-class citizens: launching the
  // game never requires a cloud account.
  const { data: selectedProfile } = useBackend({
    name: "get_selected_profile",
  });

  const { mutateAsync, isPending } = useBackendMutation({
    name: "play",
  });

  const [progress, setProgress] = useState<LaunchProgress | null>(null);
  const [justLaunched, setJustLaunched] = useState(false);

  // The Rust `play` command emits `launch-progress` events while it
  // prepares the game (manifest → java → args → spawn).
  useEffect(() => {
    const unlisten = listen<LaunchProgress>("launch-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Reset the bar when a new launch starts.
  useEffect(() => {
    if (isPending) {
      setProgress(null);
      setJustLaunched(false);
    }
  }, [isPending]);

  // Keep the completed bar visible briefly after the command resolves.
  useEffect(() => {
    if (!justLaunched) {
      return;
    }
    const timer = setTimeout(
      () => setJustLaunched(false),
      LAUNCH_DONE_LINGER_MS
    );
    return () => clearTimeout(timer);
  }, [justLaunched]);

  const noVersion = version === null;
  const noProfile = selectedProfile !== undefined && selectedProfile === null;
  const title = playButtonTitle(noVersion, noProfile);
  const text = playButtonText(isPending, noVersion);

  return (
    <>
      <LaunchProgressBar
        isPending={isPending}
        justLaunched={justLaunched}
        progress={progress}
      />

      <ActionButton
        action={async () => {
          if (version === null) {
            return;
          }
          await mutateAsync({ selectedVersion: version });
          setJustLaunched(true);
        }}
        className={cn(
          "h-16 w-full select-none rounded-xl font-black text-2xl uppercase tracking-wider transition-all",
          isPending
            ? "bg-amber-600/90 text-white shadow-[0_4px_20px_rgba(217,119,6,0.35)]"
            : noVersion
              ? "border border-white/10 bg-white/10 text-muted-foreground"
              : "bg-emerald-600 text-white shadow-[0_6px_32px_rgba(16,185,129,0.45)] hover:bg-emerald-500 hover:shadow-[0_6px_40px_rgba(16,185,129,0.65)] active:scale-[0.98]"
        )}
        disabled={isPending || noVersion}
        title={title}
      >
        {text}
      </ActionButton>
    </>
  );
}

function playButtonTitle(noVersion: boolean, noProfile: boolean) {
  if (noVersion) {
    return "Select a version first";
  }
  if (noProfile) {
    return "No profile selected — click to create one";
  }
  return "Launch Minecraft";
}

function playButtonText(isPending: boolean, noVersion: boolean) {
  if (isPending) {
    return "LAUNCHING...";
  }
  if (noVersion) {
    return "SELECT VERSION";
  }
  return "PLAY";
}
