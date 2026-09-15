import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
import { informationPages } from '@/lib/information-pages';

export const metadata: Metadata = { title: 'metatray', description: informationPages['how-it-works'].intro };

export default function Page() { return <InformationPage slug='how-it-works'/>; }
