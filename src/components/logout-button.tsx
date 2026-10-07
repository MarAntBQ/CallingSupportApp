'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { postJson } from '@/lib/api-client';

export function LogoutButton() {
  const t = useTranslations('admin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await postJson('/api/auth/logout', {});
    router.replace('/login?message=logged_out');
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={logout} disabled={busy} className="text-sm">
      {t('logout')}
    </Button>
  );
}
