import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
export const metadata: Metadata = { title: 'metatray' };
export default function Page() { return <InformationPage slug="evidence"/>; }
