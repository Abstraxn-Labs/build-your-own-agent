import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/swiggy-oauth';

export const runtime = 'nodejs';

export async function GET() {
  const record = await getValidAccessToken();
  return NextResponse.json({ connected: !!record?.accessToken });
}
