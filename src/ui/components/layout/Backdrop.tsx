/** Fundo da marca: grade sutil, brilhos e as barras diagonais em gradiente do material original. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div className="absolute -top-32 left-1/2 h-[26rem] w-[32rem] -translate-x-1/2 rounded-full bg-violet/30 blur-[90px] md:-top-40 md:h-[36rem] md:w-[60rem] md:blur-[140px]" />
      <div className="absolute top-20 -right-40 size-64 rounded-full bg-electric/20 blur-[80px] md:size-80 md:bg-electric/25 md:blur-[120px]" />
      <div className="absolute top-[28rem] -left-40 size-64 rounded-full bg-pink/15 blur-[80px] md:top-72 md:size-80 md:bg-pink/20 md:blur-[120px]" />
      <div className="absolute top-24 -right-16 h-6 w-[26rem] rotate-[-35deg] rounded-full bg-gradient-to-r from-violet/0 via-magenta/50 to-pink/70 opacity-60 blur-[1px] max-md:hidden" />
      <div className="absolute top-[26rem] -left-24 h-10 w-[30rem] rotate-[-35deg] rounded-full bg-gradient-to-r from-pink/60 via-magenta/40 to-violet/0 opacity-50 max-md:hidden" />
      <div className="absolute top-40 left-[8%] h-20 w-14 bg-dots opacity-40 max-lg:hidden" />
      <div className="absolute top-[30rem] right-[6%] size-24 animate-[spin_6s_linear_infinite] rounded-full border-[5px] border-electric/40 [border-left-color:var(--color-pink)] opacity-60 max-lg:hidden" />
    </div>
  );
}
