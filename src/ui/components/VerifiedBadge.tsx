import { useId } from "react";
import { cn } from "@/ui/lib/cn";

const SCALLOP_POINTS =
  "50.0,3.0 60.4,11.4 73.5,9.3 78.3,21.7 90.7,26.5 88.6,39.6 97.0,50.0 88.6,60.4 90.7,73.5 78.3,78.3 73.5,90.7 60.4,88.6 50.0,97.0 39.6,88.6 26.5,90.7 21.7,78.3 9.3,73.5 11.4,60.4 3.0,50.0 11.4,39.6 9.3,26.5 21.7,21.7 26.5,9.3 39.6,11.4";

interface VerifiedBadgeProps {
  className?: string;
  label?: string;
}

export function VerifiedBadge({ className, label }: VerifiedBadgeProps) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-5 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2799ff" />
          <stop offset="1" stopColor="#2169ac" />
        </linearGradient>
      </defs>
      <polygon
        points={SCALLOP_POINTS}
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M31 51 L44 63 L69 37"
        fill="none"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
