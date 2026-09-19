import { CompileScreen } from '@/components/compile/CompileScreen';

export const metadata = {
  title: 'Compile',
  description:
    'Open a health policy PDF, watch it read into a clause tree in your browser, confirm every clause, and run a hospitalisation through it.',
};

export default function CompilePage() {
  return <CompileScreen />;
}
