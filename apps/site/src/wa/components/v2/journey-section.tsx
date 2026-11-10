import { CalendarCheckIcon, ChatsCircleIcon, CursorClickIcon } from '../../ui/icons';
import { Fragment } from 'react';
import { ToneWord } from './journey/figure';
import { FigureBook } from './journey/figure-book';
import { FigureConvert } from './journey/figure-convert';
import { FigureEngage } from './journey/figure-engage';
import { type JourneyCard, JourneyStack } from './journey/journey-stack';
import { SectionHeading } from './primitives';

const STEPS: readonly JourneyCard[] = [
  {
    id: 'etape-video',
    name: 'Démo personnalisée',
    tone: 'ember',
    icon: CursorClickIcon,
    title: [
      'Une vidéo faite',
      <Fragment key="accent">
        pour <ToneWord tone="ember">votre entreprise</ToneWord>.
      </Fragment>,
    ],
    body: 'Trente secondes avec votre nom, votre ville et votre site, sur un sujet qui parle à vos clients. Vous voyez le résultat avant de décider.',
    youSet: ['Le sujet', 'Votre ton', 'Vos couleurs'],
    Figure: FigureEngage,
  },
  {
    id: 'etape-planning',
    name: 'Chaque semaine',
    tone: 'gold',
    icon: CalendarCheckIcon,
    title: [
      'Publié chaque semaine,',
      <Fragment key="accent">
        <ToneWord tone="gold">validé</ToneWord> par vous.
      </Fragment>,
    ],
    body: 'Vidéos sur Facebook, Instagram et TikTok, publications sur votre fiche Google. Nous préparons le planning, vous le validez, rien ne part sans votre accord.',
    youSet: ['Le planning', 'Les réseaux', 'Le rythme'],
    Figure: FigureBook,
  },
  {
    id: 'etape-messages',
    name: 'Messages',
    tone: 'orchid',
    icon: ChatsCircleIcon,
    title: [
      'Chaque commentaire',
      <Fragment key="accent">
        a sa <ToneWord tone="orchid">réponse</ToneWord>.
      </Fragment>,
    ],
    body: 'Nous répondons aux commentaires, aux messages et aux avis. Les demandes qui méritent votre réponse personnelle vous sont transmises.',
    youSet: ['Ce qui vous est transmis', 'Les réponses types'],
    Figure: FigureConvert,
  },
];

export function JourneySection() {
  return (
    <section
      id="comment"
      data-section="journey"
      aria-labelledby="journey-title"
      className="relative px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <SectionHeading
          id="journey-title"
          eyebrow="Comment ça marche"
          title={[
            'On s’occupe de vos réseaux.',
            <Fragment key="accent">
              Vous vous occupez de vos <ToneWord tone="brand">clients.</ToneWord>
            </Fragment>,
          ]}
          sub="Vous continuez votre métier. Nous faisons exister votre entreprise là où vos futurs clients passent leurs soirées."
        />
        <JourneyStack steps={STEPS} />
      </div>
    </section>
  );
}
