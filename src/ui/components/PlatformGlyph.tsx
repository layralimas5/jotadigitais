import type { Platform } from "@/domain/platform";
import { cn } from "@/ui/lib/cn";
import { TikTokGlyph } from "./TikTokGlyph";

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function YouTubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z"
      />
    </svg>
  );
}

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)} fill="currentColor">
      <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14C17.17 2.1 15.93 2 14.62 2 11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5Z" />
    </svg>
  );
}

const GLYPHS: Record<Platform, (props: { className?: string }) => React.JSX.Element> = {
  tiktok: TikTokGlyph,
  instagram: InstagramGlyph,
  youtube: YouTubeGlyph,
  facebook: FacebookGlyph,
};

export function PlatformGlyph({ platform, className }: { platform: Platform; className?: string }) {
  const Glyph = GLYPHS[platform];
  return <Glyph className={className} />;
}
