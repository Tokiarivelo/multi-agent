'use client';

import {
  LandingNavbar,
  LandingHero,
  LandingFeatures,
  LandingUseCases,
  LandingFooter,
} from '@/features/landing';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 transition-colors">
      <LandingNavbar />
      <LandingHero />
      <LandingFeatures />
      <LandingUseCases />
      <LandingFooter />
    </div>
  );
}
