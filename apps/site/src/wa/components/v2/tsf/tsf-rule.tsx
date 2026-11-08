import { cn } from '../../../ui/lib/utils';

export function TsfDiamond({
  outline = false,
  className,
}: {
  readonly outline?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('tk-diamond', className)}
      data-outline={outline ? '' : undefined}
    />
  );
}
