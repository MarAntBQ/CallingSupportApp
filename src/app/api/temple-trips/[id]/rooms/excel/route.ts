import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError } from '@/server/auth/errors';
import { getConfig } from '@/server/config/service';
import { getDb } from '@/server/db';
import { withAuth } from '@/server/security/route';
import { buildRoomsExcel } from '@/server/temple-trips/rooms-excel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth<{ id: string }>(
  async (_request, { params }) => {
    const id = z.uuid().safeParse(params.id);
    if (!id.success) throw new AuthError(404, 'not_found');
    const db = getDb();
    const config = await getConfig(db);
    const buffer = await buildRoomsExcel(db, id.data, config.defaultNationality);
    if (!buffer) return NextResponse.json({ error: 'invalid_input', fields: ['rooms'], issues: [{ field: 'rooms', code: 'no_rooms' }] }, { status: 400 });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="habitaciones-viaje-${id.data}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  },
  { permission: { module: 'temple-trips', action: 'read' } },
);
