"use client";

import {
  Award01Icon,
  Download01Icon,
  GameboyIcon,
  Package01Icon,
  ServerIcon,
  Settings01Icon,
  ShirtIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

/**
 * TopNav — horizontal pill navigation shown in the launcher's top bar.
 * One entry per section; the active pill is highlighted with the Pars
 * accent. Icons use Hugeicons (like the rest of the app) plus lucide
 * for the assistant sparkle.
 */
export function TopNav() {
  const { t } = useTranslation();

  const items = [
    {
      icon: <HugeiconsIcon icon={GameboyIcon} strokeWidth={2} />,
      title: t("nav_play", "Play"),
      url: "/",
    },
    {
      icon: <HugeiconsIcon icon={ServerIcon} strokeWidth={2} />,
      title: t("nav_servers", "Servers"),
      url: "/servers",
    },
    {
      icon: <HugeiconsIcon icon={ShirtIcon} strokeWidth={2} />,
      title: t("nav_skin", "Skin Studio"),
      url: "/skin",
    },
    {
      icon: <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />,
      title: t("nav_library", "Library"),
      url: "/library",
    },
    {
      icon: <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />,
      title: t("nav_downloads", "Downloads"),
      url: "/downloads",
    },
    {
      icon: <HugeiconsIcon icon={Award01Icon} strokeWidth={2} />,
      title: t("nav_profile", "Profile"),
      url: "/profile",
    },
    {
      icon: <Sparkles className="size-4 text-primary" />,
      title: t("nav_assistant", "AI Assistant"),
      url: "/assistant",
    },
    {
      icon: <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />,
      title: t("nav_settings", "Settings"),
      url: "/settings",
    },
  ];

  return (
    <nav className="pointer-events-auto flex items-center gap-1 rounded-2xl border-border/40 border bg-background/40 p-1 backdrop-blur-md">
      {items.map((item) => (
        <NavLink end={item.url === "/"} key={item.url} to={item.url}>
          {({ isActive }) => (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-semibold text-xs transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              )}
              title={item.title}
            >
              {item.icon}
              <span className="hidden lg:inline">{item.title}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
