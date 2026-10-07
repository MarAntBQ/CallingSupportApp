import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

export async function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  const t = await getTranslations('common');

  return <Image src="/logo.png" alt={t('logoAlt')} width={359} height={96} priority={priority} className={className} />;
}
