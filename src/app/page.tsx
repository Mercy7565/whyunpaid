import { Suspense } from 'react';
import { SimulateSkeleton } from '@/components/Skeleton';
import { SimulateScreen } from '@/components/simulate/SimulateScreen';

export const metadata = {
  title: 'WhyUnpaid? — run your health policy like the program it is',
  description:
    'Pick a specimen policy, set a bill and a length of cover, and watch a hospitalisation run through the clause tree. Every deduction names the clause that caused it.',
};

export default function SimulatePage() {
  return (
    <Suspense fallback={<SimulateSkeleton />}>
      <SimulateScreen />
    </Suspense>
  );
}
