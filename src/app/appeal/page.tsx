import { Suspense } from 'react';
import { AppealScreen } from '@/components/appeal/AppealScreen';
import { SkeletonBar } from '@/components/Skeleton';

export const metadata = {
  title: 'Appeal',
  description:
    'Paste the reason an insurer gave for refusing a claim. The same claim runs through the compiled policy, and where the two disagree, that disagreement is the appeal.',
};

function AppealSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-6 pt-3 sm:px-4" aria-busy="true">
      <p className="sr-only">Preparing the appeal review.</p>
      <div className="mb-4 flex flex-col gap-2">
        <SkeletonBar width={70} height={10} />
        <SkeletonBar width="min(420px, 80%)" height={38} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-2">
          <SkeletonBar height={150} />
          <SkeletonBar height={44} />
          <SkeletonBar height={44} />
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonBar height={120} />
          <SkeletonBar height={200} />
        </div>
      </div>
    </div>
  );
}

export default function AppealPage() {
  return (
    <Suspense fallback={<AppealSkeleton />}>
      <AppealScreen />
    </Suspense>
  );
}
