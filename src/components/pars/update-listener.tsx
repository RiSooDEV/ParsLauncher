import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export function ParsUpdateListener() {
  const qc = useQueryClient();
  useEffect(() => {
    const unlisten = listen("pars-update", () => {
      qc.invalidateQueries({ queryKey: ["pars"] });
      qc.invalidateQueries({ queryKey: ["pars", "get"] });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [qc]);
  return null;
}
