import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import StoredImage from '@/models/StoredImage';
import { getSession, unauthorized } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

/** Detect the real image type from its first bytes (never trust the file name). */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) {
    return 'image/gif';
  }
  return null;
}

/**
 * POST /api/upload (multipart, field "file") — signed-in users only.
 * Accepts JPEG / PNG / WebP / GIF up to 2 MB, checked by content. SVG and
 * HTML are refused (they can carry scripts). Returns { url: /api/images/<id> }.
 */
export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();

  const limit = await rateLimit(`upload:${session.userId}`, 30, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, message: 'Too many uploads. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, message: 'Image must be 2 MB or smaller' }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = sniffImageType(buffer);
    if (!contentType) {
      return NextResponse.json(
        { success: false, message: 'Only JPG, PNG, WebP or GIF images are allowed' },
        { status: 415 }
      );
    }

    await dbConnect();
    const image = await StoredImage.create({
      data: buffer,
      contentType,
      size: buffer.length,
      ownerId: session.userId,
    });
    return NextResponse.json({ success: true, url: `/api/images/${image._id}` });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, message: 'Failed to upload file' }, { status: 500 });
  }
}
