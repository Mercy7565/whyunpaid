import type { Metadata, Viewport } from 'next';
import { Archivo, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/*
 * One typeface family, two cuts. `ui` is the grotesk at normal width; `display`
 * is the same design at 112% width, used only for figures and the wordmark.
 * Devanagari is a script fallback for the Hindi appeal body, not a third voice.
 */
const ui = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-ui-src',
});

const deva = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-deva-src',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://whyunpaid.vercel.app'),
  title: {
    default: 'WhyUnpaid? — run your health policy like the program it is',
    template: '%s · WhyUnpaid?',
  },
  description:
    'Your policy is already a program. Nobody can read it. So run it. WhyUnpaid? compiles a health insurance policy into a clause tree and shows exactly which clause took which rupee.',
  applicationName: 'WhyUnpaid?',
  openGraph: {
    title: 'WhyUnpaid?',
    description: 'Your policy is already a program. Nobody can read it. So run it.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#3A2449',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${deva.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:panel-raised focus:px-2 focus:py-1 ink-strong"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1 w-full">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
