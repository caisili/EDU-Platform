import { NextResponse } from 'next/server';
import { db, connected } from '../../../lib/eduData';

export async function GET() {
  if (!connected) {
    return NextResponse.json({ connected: false });
  }

  try {
    const profiles = await db('/profiles?select=*');
    const classes = await db('/classes?select=*');
    const enrollments = await db('/class_enrollments?select=*');

    return NextResponse.json({
      connected: true,
      profilesCount: profiles.length,
      profiles,
      classesCount: classes.length,
      classes,
      enrollmentsCount: enrollments.length,
      enrollments
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: true,
        error: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
