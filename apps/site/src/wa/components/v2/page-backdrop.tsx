import { TsfRails } from './tsf/tsf-rails';

export function PageBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="paper pointer-events-none fixed inset-0 -z-10">
        <div className="grain absolute inset-0" />
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <TsfRails />
      </div>
    </>
  );
}
