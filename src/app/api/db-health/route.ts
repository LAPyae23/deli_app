import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const collections = await db.listCollections().toArray();

    return NextResponse.json({
      success: true,
      message: 'Connected to MongoDB',
      database: db.databaseName,
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'MongoDB connection failed', error: message },
      { status: 500 }
    );
  }
}
