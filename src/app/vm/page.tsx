import { Suspense } from 'react';
import { SkeletonBar } from '@/components/Skeleton';
import { VmScreen } from '@/components/vm/VmScreen';

export const metadata = {
  title: 'Inspector',
  description:
    'The compiled clause tree, the fixed evaluation order and the test run behind WhyUnpaid?. Select a clause to see the words it was compiled from, highlighted in the specimen wording.',
};

function VmSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-2 pb-6 pt-3 sm:px-4" aria-busy="true">
      <p className="sr-only">Preparing the inspector.</p>
      <div className="mb-4 flex flex-col gap-2">
        <SkeletonBar width={140} height={10} />
        <SkeletonBar width="min(420px, 80%)" height={38} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-1">
          <SkeletonBar height={70} />
          <SkeletonBar height={70} />
          <SkeletonBar height={70} />
        </div>
        <SkeletonBar height={320} />
      </div>
    </div>
  );
}

export default function VmPage() {
  return (
    <Suspense fallback={<VmSkeleton />}>
      <VmScreen />
    </Suspense>
  );
}
