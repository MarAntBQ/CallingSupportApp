'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useConfig } from '@/lib/config/use-config';
import { unitInitials } from '@/lib/validation/config';

export function UnitLogo({ name, logoDataUrl, size = 40 }: { name: string; logoDataUrl: string | null; size?: number }) {
  const t = useTranslations('settings');
  if (logoDataUrl) {
    return (
      <Image
        src={logoDataUrl}
        alt={t('logo.alt', { name })}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-on-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {unitInitials(name)}
    </span>
  );
}

export function UnitBrand({ size = 40, className, fallback = null }: { size?: number; className?: string; fallback?: ReactNode }) {
  const { data } = useConfig();
  if (!data?.unitName) return fallback;
  return (
    <span className={`flex min-w-0 items-center gap-3 ${className ?? ''}`}>
      <UnitLogo name={data.unitName} logoDataUrl={data.logoDataUrl} size={size} />
      <span className="truncate text-base font-semibold text-text" data-testid="unit-name">
        {data.unitName}
      </span>
    </span>
  );
}
