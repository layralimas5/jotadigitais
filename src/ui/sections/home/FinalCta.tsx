import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/ui/components/Button";
import { Logo } from "@/ui/components/Logo";
import { Reveal } from "@/ui/components/Reveal";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-brand p-px">
          <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-ink px-6 py-16 text-center md:px-16 md:py-24">
            <div aria-hidden className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
            <div aria-hidden className="absolute -top-32 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-violet/40 blur-[120px]" />
            <div className="relative">
              <Logo size="lg" className="mx-auto" />
              <h2 id="cta-title" className="mx-auto mt-10 max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance text-white md:text-5xl">
                Pare de esperar aprovação. Comece a vender esta semana.
              </h2>
              <ButtonLink to="/contas" size="lg" className="mt-10">
                Escolher minha conta <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
