import type { Metadata, Viewport } from 'next';
import { Archivo, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE_URL } from '@/lib/site';
import { THEME_BOOTSTRAP } from '@/components/ThemeToggle';

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

const DESCRIPTION =
  'Your policy is already a program. Nobody can read it. So run it. WhyUnpaid? compiles a health insurance policy into a clause tree and shows exactly which clause took which rupee.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'WhyUnpaid? — run your health policy like the program it is',
    template: '%s · WhyUnpaid?',
  },
  description: DESCRIPTION,
  applicationName: 'WhyUnpaid?',
  alternates: { canonical: '/' },
  keywords: [
    'health insurance',
    'claim rejection',
    'IRDAI',
    'room rent proportionate deduction',
    'moratorium',
    'policy wording',
    'India',
  ],
  authors: [{ name: 'WhyUnpaid?' }],
  openGraph: {
    title: 'WhyUnpaid?',
    description: 'Your policy is already a program. Nobody can read it. So run it.',
    url: SITE_URL,
    siteName: 'WhyUnpaid?',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WhyUnpaid?',
    description: 'Your policy is already a program. Nobody can read it. So run it.',
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0F1429' },
    { media: '(prefers-color-scheme: light)', color: '#E3EDF4' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${deva.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Applies a stored theme choice before first paint. Without this, a
          reader who chose light would see the dark page for one frame on every
          navigation, which is exactly the flicker a theme switcher exists to
          avoid.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
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
