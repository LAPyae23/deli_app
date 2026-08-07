import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

function mapApplication(doc: Record<string, unknown>) {
  const submittedAt = doc.submittedAt || doc.createdAt;
  const date = submittedAt ? new Date(String(submittedAt)) : new Date();

  return {
    id: String(doc._id),
    type: 'RIDER' as const,
    name:
      (doc.ownerName as string) ||
      `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
      'Driver',
    submittedBy:
      (doc.ownerName as string) ||
      `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
      'Driver',
    email: doc.email as string,
    phone: (doc.phone as string) || '',
    vehicleType: (doc.vehicleType as string) || 'Not specified',
    licenseNumber: (doc.licenseNumber as string) || '',
    address: (doc.address as string) || 'Not provided',
    description: (doc.description as string) || '',
    submittedAt: date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    submittedAtIso: date.toISOString(),
    documents: Array.isArray(doc.documents) ? doc.documents.length : 0,
    status: (doc.status as string) || 'PENDING',
    userId: doc.userId ? String(doc.userId) : null,
  };
}

async function syncUserApproval(
  db: Awaited<ReturnType<typeof getDb>>,
  application: Record<string, unknown>,
  status: 'APPROVED' | 'REJECTED',
  now: string
) {
  const updates: Promise<unknown>[] = [];
  if (application.email) {
    updates.push(
      db.collection('users').updateOne(
        { email: String(application.email).toLowerCase(), role: 'RIDER' },
        { $set: { approvalStatus: status, updatedAt: now } }
      )
    );
  }
  if (application.userId && ObjectId.isValid(String(application.userId))) {
    updates.push(
      db.collection('users').updateOne(
        { _id: new ObjectId(String(application.userId)) },
        { $set: { approvalStatus: status, updatedAt: now } }
      )
    );
  }
  if (updates.length) await Promise.all(updates);
}

async function ensureDriverProfile(
  db: Awaited<ReturnType<typeof getDb>>,
  application: Record<string, unknown>,
  now: string
) {
  const profileMatch: Record<string, unknown>[] = [];
  if (application.email) profileMatch.push({ email: application.email });
  if (application.userId) profileMatch.push({ userId: application.userId });

  const existing =
    profileMatch.length > 0
      ? await db.collection('driverprofiles').findOne({ $or: profileMatch })
      : null;

  if (existing) {
    await db.collection('driverprofiles').updateOne(
      { _id: existing._id },
      { $set: { status: 'APPROVED', approvedAt: existing.approvedAt || now, updatedAt: now } }
    );
    return;
  }

  await db.collection('driverprofiles').insertOne({
    userId: application.userId,
    firstName: application.firstName,
    lastName: application.lastName,
    ownerName: application.ownerName,
    email: application.email,
    phone: application.phone,
    vehicleType: application.vehicleType || 'Not specified',
    licenseNumber: application.licenseNumber || '',
    address: application.address || 'Not provided',
    description: application.description || '',
    documents: application.documents || [],
    status: 'APPROVED',
    approvedAt: now,
    createdAt: application.createdAt || now,
    updatedAt: now,
    __v: 0,
  });
}

async function cleanupApprovedApplications(db: Awaited<ReturnType<typeof getDb>>) {
  const approved = await db
    .collection('driverapplications')
    .find({ status: 'APPROVED' })
    .toArray();

  const now = new Date().toISOString();
  for (const application of approved) {
    await ensureDriverProfile(db, application, now);
    await syncUserApproval(db, application, 'APPROVED', now);
    await db.collection('driverapplications').deleteOne({ _id: application._id });
  }

  return approved.length;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const db = await getDb();
    await cleanupApprovedApplications(db);

    const filter: Record<string, unknown> = {};
    if (status !== 'ALL') {
      filter.status = status;
    }

    const applications = await db
      .collection('driverapplications')
      .find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      applications: applications.map((doc) => mapApplication(doc)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch driver applications', error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: 'Application id and status are required' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid application id' },
        { status: 400 }
      );
    }

    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return NextResponse.json(
        { success: false, message: 'Status must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const filter = { _id: new ObjectId(id) };
    const application = await db.collection('driverapplications').findOne(filter);

    if (!application) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (status === 'APPROVED') {
      await ensureDriverProfile(db, application, now);
      await syncUserApproval(db, application, 'APPROVED', now);
      await db.collection('driverapplications').deleteOne(filter);

      return NextResponse.json({
        success: true,
        message:
          'Driver approved. Moved to driver profiles and removed from applications. They can now log in.',
        application: mapApplication({ ...application, status: 'APPROVED', _id: application._id }),
      });
    }

    await syncUserApproval(db, application, 'REJECTED', now);
    await db.collection('driverapplications').deleteOne(filter);

    return NextResponse.json({
      success: true,
      message:
        'Driver application rejected and removed from applications. User kept for rejection login message.',
      application: mapApplication({ ...application, status: 'REJECTED', _id: application._id }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to update driver application', error: message },
      { status: 500 }
    );
  }
}

/** Reject: remove application, keep user with approvalStatus REJECTED */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Application id is required' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid application id' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const filter = { _id: new ObjectId(id) };
    const application = await db.collection('driverapplications').findOne(filter);

    if (!application) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    await syncUserApproval(db, application, 'REJECTED', now);
    await db.collection('driverapplications').deleteOne(filter);

    return NextResponse.json({
      success: true,
      message:
        'Driver application rejected and removed. User account kept for rejection login message.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to reject driver application', error: message },
      { status: 500 }
    );
  }
}
