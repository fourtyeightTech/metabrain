import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
export const metadata: Metadata = { title: 'Code & evidence' };
export default function Page() { return <InformationPage slug="evidence"/>; }
