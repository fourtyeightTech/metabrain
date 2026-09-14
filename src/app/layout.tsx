import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Tray — Cortical Market Observatory', template: '%s | Tray' },
  applicationName: 'Tray',
  description: 'Tray connects token-market observations with Meta TRIBE v2 cortical-response research, inspectable inputs and paper trading. An independent experiment.'
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
