import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
export const metadata: Metadata = { title: 'metatray', description: 'The science-grounded story behind MetaTray’s live market pulses, sensory experiences, cortical echoes and response chronicle.' };
export default function Page() { return <InformationPage slug="lore"/>; }
