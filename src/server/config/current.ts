import 'server-only';
import { cache } from 'react';
import { getDb } from '@/server/db';
import { getConfig } from './service';

export const currentConfig = cache(() => getConfig(getDb()));
