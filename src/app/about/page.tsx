import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
import { informationPages } from '@/lib/information-pages';

export const metadata: Metadata = { title: 'About', description: informationPages['about'].intro };

export default function Page() { return <InformationPage slug='about'/>; }
