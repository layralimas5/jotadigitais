import { cn } from "@/ui/lib/cn";

export function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)} fill="currentColor">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.37-2.48V9.66a5.67 5.67 0 0 0-.77-.05 5.73 5.73 0 0 0-5.73 5.73A5.73 5.73 0 0 0 9.86 21a5.73 5.73 0 0 0 5.73-5.73V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.29-1.48Z" />
    </svg>
  );
}
