/**
 * Skeletons, not spinners.
 *
 * A spinner says "something is happening". A skeleton says "this is what is
 * about to be here", which is the more useful of the two, and it means nothing
 * on the page moves when the real content arrives.
 */

export function SkeletonBar({
  width = '100%',
  height = 12,
  className,
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton block ${className ?? ''}`}
      style={{ width: typeof width === 'number' ? `${width}px` : width, height: `${height}px` }}
    />
  );
}

export function SimulateSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-6 pt-3 sm:px-4" aria-busy="true">
      <p className="sr-only">Preparing the simulator.</p>
      <div className="mb-4 flex flex-col gap-2">
        <SkeletonBar width={90} height={10} />
        <SkeletonBar width="min(420px, 80%)" height={38} />
        <SkeletonBar width="min(520px, 92%)" height={12} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[336px_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-3">
          <SkeletonBar height={34} />
          <SkeletonBar height={12} width="80%" />
          <SkeletonBar height={34} />
          <SkeletonBar height={34} />
          <SkeletonBar height={34} />
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonBar height={10} width={110} />
          <SkeletonBar height={10} />
          <div className="mt-2 flex flex-col gap-2">
            <SkeletonBar height={30} />
            <SkeletonBar height={30} />
            <SkeletonBar height={30} />
            <SkeletonBar height={30} />
          </div>
          <SkeletonBar height={72} width="min(360px, 90%)" className="mt-3" />
        </div>
      </div>
    </div>
  );
}
