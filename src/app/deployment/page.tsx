import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
import { informationPages } from '@/lib/information-pages';

export const metadata: Metadata = { title: 'Model setup', description: informationPages['deployment'].intro };

export default function Page() { return <InformationPage slug='deployment'/>; }
