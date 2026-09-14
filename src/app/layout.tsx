import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Tray the Trader — Cortical Market Observatory',
  description: 'A paper-trading observatory connecting token market stimuli with predicted cortical responses. Independent research software.'
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
