import { ControlPanel } from './control-panel';
import { SectionHeading } from './primitives';

const controlStyles = `
@keyframes control-now { 0% { left: 34%; } 100% { left: 74%; } }
.control-now { left: 52%; animation: control-now 9s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) { .control-now { animation: none; } }
`;

export function ControlSection() {
  return (
    <section
      id="conformite"
      data-section="control"
      aria-labelledby="control-title"
      className="relative scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32"
    >
      <style>{controlStyles}</style>
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-14 sm:gap-16">
        <SectionHeading
          id="control-title"
          eyebrow="Conformité"
          title={[
            'Conforme à votre profession.',
            <span key="l2" className="text-brand-active dark:text-brand">
              Validé par vous.
            </span>,
          ]}
          sub="Les règles de l’AMF, de l’ORIAS ou de votre Ordre sont intégrées à chaque vidéo. Rien n’est publié sans votre accord."
        />
        <ControlPanel />
      </div>
    </section>
  );
}
