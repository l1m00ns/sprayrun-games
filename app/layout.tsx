import type { Metadata, Viewport } from 'next';
import './globals.css';
import './hub.css';

export const metadata: Metadata = {
  title: 'Reverse Surfers',
  description: 'Reverse Surfers - original 3D endless runner: 5 maps, oncoming trains, ranked online races, seasonal events, FPS duels.',
  icons: { icon: '/logo.png', apple: '/logo.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, themeColor: '#0b1230', viewportFit: 'cover' }; // cover: use the notch area; the CSS keeps controls inside the safe area

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* runtime override of the backend address (public/config.js), loaded before the game starts */}
        <script src="/config.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
