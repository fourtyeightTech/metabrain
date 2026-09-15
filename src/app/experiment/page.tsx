import type { Metadata } from 'next';
import { InformationPage } from '@/components/information-page';
import { informationPages } from '@/lib/information-pages';

export const metadata: Metadata = {
  title: 'metatray',
  description: informationPages.experiment.intro
};

export default function ExperimentPage() {
  return <InformationPage slug="experiment"/>;
}
