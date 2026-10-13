import { NextResponse } from 'next/server';
import { db, connected } from '../../../lib/eduData';

export async function GET() {
  if (!connected) {
    return NextResponse.json({
      connected: false,
      error: 'Supabase is not configured'
    });
  }

  try {
    const schools = await db(
      'schools?select=id,name'
    );

    return NextResponse.json({
      connected: true,
      count: schools?.length || 0,
      schools
    });
  } catch (error: any) {
    return NextResponse.json({
      connected: true,
      error: error?.message || String(error)
    });
  }
}
