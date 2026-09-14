import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
import { informationPages } from '@/lib/information-pages';

export const metadata: Metadata = { title: 'Privacy', description: informationPages['privacy'].intro };

export default function Page() { return <InformationPage slug='privacy'/>; }
