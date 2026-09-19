import { DISCLAIMER_SPECIMEN, DISCLAIMER_ESTIMATE } from '@/lib/copy';

export function SiteFooter() {
  return (
    <footer className="hair-t mt-8" data-print="hide">
      <div className="mx-auto w-full max-w-[1280px] px-2 py-4 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="measure">
            <p className="text-[13px] leading-[1.6] ink-muted">{DISCLAIMER_SPECIMEN}</p>
            <p className="mt-1 text-[13px] leading-[1.6] ink-muted">{DISCLAIMER_ESTIMATE}</p>
          </div>
          <p className="shrink-0 text-[13px] ink-muted sm:text-right">
            WhyUnpaid? <span aria-hidden="true">·</span> no account, no upload, no tracking
          </p>
        </div>
      </div>
    </footer>
  );
}
