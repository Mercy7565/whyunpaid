import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WhyUnpaid?',
    short_name: 'WhyUnpaid?',
    description: 'Your policy is already a program. Nobody can read it. So run it.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080B1A',
    theme_color: '#080B1A',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
