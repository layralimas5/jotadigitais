import type { SVGProps } from "react";

/** Ampulheta no traço dos ícones do painel, com a areia caindo e a virada a cada ciclo (para quem não pediu menos movimento). */
export function AnimatedHourglass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g className="hourglass-body">
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
        <polygon className="hourglass-top" points="9,5 15,5 12,10" fill="currentColor" stroke="none" />
        <line className="hourglass-stream" x1="12" y1="11" x2="12" y2="19" strokeWidth="1" />
        <polygon className="hourglass-bottom" points="15,19 9,19 12,14" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
