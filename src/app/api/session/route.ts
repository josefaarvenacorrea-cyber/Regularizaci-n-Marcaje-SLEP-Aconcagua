import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getConfig } from '@/lib/casos';

export async function GET() {
  const session = await getSession();
  const config = await getConfig();
  return NextResponse.json({ session, config });
}
