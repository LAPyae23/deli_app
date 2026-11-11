import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import StoredImage from '@/models/StoredImage';

/** GET /api/images/[id] — serve an uploaded image (public, cached for a year). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return new Response('Not found', { status: 404 });
  await dbConnect();
  // Not lean(): a hydrated document gives a real Node Buffer for `data`.
  const image = await StoredImage.findById(id).select('data contentType');
  if (!image) return new Response('Not found', { status: 404 });
  const bytes = new Uint8Array(image.data as Buffer);
  return new Response(bytes, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
