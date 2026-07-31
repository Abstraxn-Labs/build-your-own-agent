import { NextResponse } from 'next/server';
import { isConnected } from '@/lib/swiggy-oauth';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ connected: isConnected() });
}
