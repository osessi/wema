import { vsl } from '../../config/media';
import { signupHref } from '../../config/site';
import { hero } from '../../content/hero';
import SlantMorphButton from '../tweenui/slant-morph-button';
import { SectionHeading } from './primitives';
import { PromoVideo } from './promo-video';

/**
 * La vidéo de présentation, sous l'accroche. Tant qu'elle n'est pas tournée
 * (`vsl.src` à null), l'emplacement est réservé et l'annonce.
 */
export function FilmSection() {
  return (
    <section
      id="presentation"
      data-section="film"
      aria-labelledby="film-title"
      className="relative scroll-mt-28 bg-transparent pt-16 pb-24 sm:pt-24 sm:pb-32"
    >
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-8">
        <SectionHeading
          id="film-title"
          eyebrow="En une minute"
          title={[
            'Voyez comment il fait',
            <span key="l2" className="text-brand-active dark:text-brand">
              trouver votre enfant.
            </span>,
          ]}
        />
        <div className="mt-12 sm:mt-16">
          <PromoVideo film={vsl} />
        </div>
        <div className="mt-10 flex justify-center sm:mt-12">
          <SlantMorphButton href={signupHref}>{hero.cta}</SlantMorphButton>
        </div>
      </div>
    </section>
  );
}
