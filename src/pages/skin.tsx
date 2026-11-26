import { Shirt } from "lucide-react";
import { SkinStudio } from "@/components/skin-studio/skin-studio";
import { useBackend } from "@/hooks/use-backend";

/**
 * Skin Studio page — skin setting is available to everyone: import by
 * username, upload a PNG, dress capes/elytra and apply the skin for
 * offline play. The active skin is injected by the backend at launch.
 */
export default function SkinPage() {
  const { data: selectedProfile } = useBackend({
    name: "get_selected_profile",
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Shirt className="size-5" />
        </div>
        <div>
          <h1 className="font-black text-xl leading-tight">Skin Studio</h1>
          <p className="text-muted-foreground text-xs">
            Upload, steal or design a skin — applied for every server at
            launch.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <SkinStudio
          currentUsername={selectedProfile?.username ?? undefined}
        />
      </div>
    </div>
  );
}
