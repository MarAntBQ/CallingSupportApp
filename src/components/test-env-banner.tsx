import { getTranslations } from 'next-intl/server';
import type { AppEnv } from '@/lib/app-env';
import { isSharedTestEnv } from '@/lib/app-env';

// Banner fijo arriba en los ambientes compartidos (staging/demo): avisa que los datos son
// inventados. No se muestra en desarrollo ni en producción.
export async function TestEnvBanner({ env }: { env: AppEnv }) {
  if (!isSharedTestEnv(env)) return null;
  const t = await getTranslations('env');
  const text = env === 'demo' ? t('bannerDemo') : t('bannerStaging');
  return (
    <p role="status" className="bg-warning/15 px-4 py-2 text-center text-sm font-medium text-text">
      {text}
    </p>
  );
}
