import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/ui/components/Button";
import { Logo } from "@/ui/components/Logo";
import { Reveal } from "@/ui/components/Reveal";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative py-14 sm:py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-brand p-px sm:rounded-[2rem]">
          <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-ink px-5 py-10 text-center sm:rounded-[calc(2rem-1px)] sm:px-6 sm:py-16 md:px-16 md:py-24">
            <div aria-hidden className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
            <div aria-hidden className="absolute -top-32 left-1/2 h-64 w-[24rem] -translate-x-1/2 rounded-full bg-violet/40 blur-[80px] md:h-72 md:w-[40rem] md:blur-[120px]" />
            <div className="relative">
              <Logo size="lg" className="mx-auto max-sm:text-[2.6rem]" />
              <h2 id="cta-title" className="mx-auto mt-6 max-w-2xl font-display text-section font-semibold tracking-tight text-balance text-white sm:mt-10 md:text-5xl">
                <span className="block sm:inline">Pare de esperar aprovação.</span>{" "}
                <span className="block sm:inline">Comece a vender esta semana.</span>
              </h2>
              <ButtonLink to="/contas" size="lg" className="mt-7 w-full sm:mt-10 sm:w-auto">
                Escolher minha conta <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
