import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
import { informationPages } from '@/lib/information-pages';

export const metadata: Metadata = { title: 'The science', description: informationPages['science'].intro };

export default function Page() { return <InformationPage slug='science'/>; }
