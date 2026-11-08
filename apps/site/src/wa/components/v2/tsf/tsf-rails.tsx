'use client';

import { cn } from '../../../ui/lib/utils';
import { useEffect, useState } from 'react';

export function TsfRails({
  half = 580,
  gutter = 28,
}: {
  readonly half?: number;
  readonly gutter?: number;
}) {
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (footer === null) return;
    const observer = new IntersectionObserver(([entry]) =>
      setFooterInView(entry?.isIntersecting ?? false),
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const at = [-half - gutter, -half, half, half + gutter];
  return (
    <div
      aria-hidden="true"
      className={cn(
        'tk-rails hidden transition-opacity duration-500 lg:block',
        footerInView && 'opacity-0',
      )}
    >
      {at.map((x) => (
        <span key={x} style={{ left: `calc(50% + ${x}px)` }} />
      ))}
    </div>
  );
}
