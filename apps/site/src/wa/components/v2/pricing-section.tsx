import { cn } from '../../ui/lib/utils';
import {
  commitmentMonths,
  extraChannelMonthly,
  formatEuros,
  type Plan,
  plans,
} from '../../config/pricing';
import { videoRequestHref } from '../../config/site';
import { PricingIncludes } from './pricing/includes';
import { Frame, SectionHeading } from './primitives';
import { TsfCta, TsfLink } from './tsf/tsf-cta';
import { TsfDecode } from './tsf/tsf-decode';
import { TsfOdometer } from './tsf/tsf-odometer';

function Price({ plan }: { readonly plan: Plan }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2">
        <TsfOdometer
          value={formatEuros(plan.monthly)}
          className="text-[56px] leading-none font-light tracking-[-0.04em] tabular-nums sm:text-[68px]"
        />
        <span className="text-[17px] font-medium opacity-75">par mois</span>
      </p>
      {plan.firstMonth === null ? null : (
        <p className="text-[17px] opacity-80">
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-[15px] font-semibold text-[var(--on-brand)]">
            {formatEuros(plan.firstMonth)} le premier mois
          </span>
        </p>
      )}
    </div>
  );
}

function PlanCard({ plan }: { readonly plan: Plan }) {
  const dark = plan.recommended;
  return (
    <Frame tone={dark ? 'graphite' : 'surface'} innerClassName="relative">
      {dark ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_0%_0%,rgb(255_197_41/0.32),transparent_70%)]"
        />
      ) : null}
      <div
        className={cn(
          'relative grid lg:grid-cols-[0.9fr_1.1fr]',
          dark ? 'text-[#F5F6F0]' : 'text-foreground',
        )}
        {...(dark ? { 'data-theme': 'dark' } : {})}
      >
        <div className="flex flex-col gap-8 border-b border-current/10 p-7 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center bg-[#151610] [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]">
                {/* biome-ignore lint/performance/noImgElement: a small static logo. */}
                <img src="/brand/icone.png" alt="" className="h-5 w-auto" />
              </span>
              <span className="text-[22px] font-normal tracking-[-0.03em]">{plan.name}</span>
              {plan.recommended ? (
                <TsfDecode
                  text="Recommandée"
                  className="ml-auto text-[12px] font-medium tracking-[0.08em] text-brand uppercase"
                />
              ) : null}
            </div>
            <Price plan={plan} />
            <p className="max-w-[400px] text-[16px] leading-relaxed opacity-75">{plan.pitch}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TsfCta href={videoRequestHref} tone={dark ? 'accent' : 'ink'}>
              Commencer par une démo offerte
            </TsfCta>
          </div>
        </div>

        <div className="p-7 sm:p-10 lg:p-12">
          <TsfDecode
            text="La formule comprend"
            className="text-[12px] font-medium tracking-[0.08em] uppercase opacity-60"
          />
          <PricingIncludes plan={plan} />
        </div>
      </div>
    </Frame>
  );
}

export function PricingSection() {
  return (
    <section
      id="offre"
      data-section="pricing"
      aria-labelledby="pricing-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="pricing-title"
          eyebrow="L’offre"
          title={[
            'Un abonnement mensuel,',
            <span key="l2" className="text-brand-active dark:text-brand">
              des vidéos chaque semaine.
            </span>,
          ]}
          sub={`Engagement de ${commitmentMonths} mois. Si le premier mois ne vous convient pas, il vous est remboursé.`}
        />

        <div className="mt-14 flex flex-col gap-8 lg:mt-16">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mt-10 text-center text-[16px] font-medium text-foreground/70">
          Un canal en plus : +{formatEuros(extraChannelMonthly)} par mois. Parrainage : un mois
          offert par client recommandé qui signe.{' '}
          <TsfLink href="/terms" className="font-medium">
            Conditions
          </TsfLink>
        </p>
      </div>
    </section>
  );
}
