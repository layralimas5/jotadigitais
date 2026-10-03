import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { Faq } from "@/ui/sections/home/Faq";
import { FeaturedAccounts } from "@/ui/sections/home/FeaturedAccounts";
import { FinalCta } from "@/ui/sections/home/FinalCta";
import { Guarantee } from "@/ui/sections/home/Guarantee";
import { Hero } from "@/ui/sections/home/Hero";
import { HowItWorks } from "@/ui/sections/home/HowItWorks";
import { ProblemSection } from "@/ui/sections/home/ProblemSection";
import { Results } from "@/ui/sections/home/Results";

export default function HomePage() {
  useDocumentMeta("");
  return (
    <>
      <Hero />
      <ProblemSection />
      <FeaturedAccounts />
      <HowItWorks />
      <Results />
      <Guarantee />
      <Faq />
      <FinalCta />
    </>
  );
}
