/** Ícone de calendário nas cores do Google, desenhado aqui (não é o logo oficial). Decorativo. */
export function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" />
      <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2H3V7Z" fill="#4285F4" />
      <rect x="7" y="2.5" width="2" height="4" rx="1" fill="#1A73E8" />
      <rect x="15" y="2.5" width="2" height="4" rx="1" fill="#1A73E8" />
      <rect x="6.5" y="11.5" width="3" height="3" rx="0.8" fill="#EA4335" />
      <rect x="10.5" y="11.5" width="3" height="3" rx="0.8" fill="#FBBC04" />
      <rect x="14.5" y="11.5" width="3" height="3" rx="0.8" fill="#34A853" />
      <rect x="6.5" y="15.5" width="3" height="3" rx="0.8" fill="#4285F4" />
      <rect x="10.5" y="15.5" width="3" height="3" rx="0.8" fill="#34A853" />
    </svg>
  );
}
