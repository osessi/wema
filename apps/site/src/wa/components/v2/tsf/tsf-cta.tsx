'use client';

import { cn } from '../../../ui/lib/utils';
import type { ReactNode } from 'react';
import { newTabProps } from '../../../lib/external-link';
import { chamfer } from '../../reactbits/TicketStubFooter';

const CUT = chamfer(0, 0, 12, 0);

export function TsfArrow() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TsfCta({
  href,
  children,
  tone = 'ink',
  size = 'md',
  className,
}: {
  readonly href: string;
  readonly children: ReactNode;
  readonly tone?: 'ink' | 'accent';
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}) {
  return (
    <a
      href={href}
      className={cn('tk-cta', className)}
      data-tone={tone}
      data-size={size}
      style={{ clipPath: CUT }}
    >
      <span>{children}</span>
      <TsfArrow />
    </a>
  );
}

export function TsfLink({
  href,
  children,
  className,
}: {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <a href={href} className={cn('tk-link', className)} {...newTabProps(href)}>
      {children}
    </a>
  );
}
