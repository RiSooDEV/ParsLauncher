/**
 * Built-in preset avatars shipped with the launcher (`public/avatars`).
 * Preset ids are stored in the user's Pars profile; keep the four
 * original ids ("pars", "blue", "ice", "deep") stable so existing
 * saved profiles keep resolving.
 */
export interface PresetAvatar {
  id: string;
  label: string;
  src: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "pars", label: "Pars", src: "/avatars/pars.png" },
  { id: "blue", label: "Bolt", src: "/avatars/blue.png" },
  { id: "ice", label: "Ice", src: "/avatars/ice.png" },
  { id: "deep", label: "Moon", src: "/avatars/deep.png" },
  { id: "cube", label: "Cube", src: "/avatars/cube.png" },
  { id: "crown", label: "Crown", src: "/avatars/crown.png" },
  { id: "comet", label: "Comet", src: "/avatars/comet.png" },
  { id: "gem", label: "Gem", src: "/avatars/gem.png" },
];

/** Image URL for a preset avatar id; unknown ids fall back to the brand avatar. */
export function presetAvatarSrc(id: string): string {
  return PRESET_AVATARS.find((a) => a.id === id)?.src ?? "/avatars/pars.png";
}
