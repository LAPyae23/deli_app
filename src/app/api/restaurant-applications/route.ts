import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

function mapApplication(doc: Record<string, unknown>) {
  const submittedAt = doc.submittedAt || doc.createdAt;
  const date = submittedAt ? new Date(submittedAt as string) : new Date();

  return {
    id: String(doc._id),
    type: 'VENDOR' as const,
    name: doc.restaurantName || 'Unnamed Restaurant',
    submittedBy: doc.ownerName || `${doc.firstName || ''} ${doc.lastName || ''}`.trim(),
    email: doc.email,
    phone: doc.phone || '',
    cuisine: doc.cuisine || 'Not specified',
    address: doc.address || 'Not provided',
    description: doc.description || '',
    submittedAt: date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    submittedAtIso: date.toISOString(),
    documents: Array.isArray(doc.documents) ? doc.documents.length : 0,
    status: doc.status || 'PENDING',
    userId: doc.userId ? String(doc.userId) : null,
    commissionRate: doc.commissionRate ?? 18,
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
        { email: String(application.email).toLowerCase(), role: 'RESTAURANT' },
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

async function ensureRestaurantProfile(
  db: Awaited<ReturnType<typeof getDb>>,
  application: Record<string, unknown>,
  now: string
) {
  const profileMatch: Record<string, unknown>[] = [];
  if (application.email) profileMatch.push({ email: application.email });
  if (application.userId) profileMatch.push({ userId: application.userId });

  const existingProfile =
    profileMatch.length > 0
      ? await db.collection('restaurantprofiles').findOne({ $or: profileMatch })
      : null;

  if (!existingProfile) {
    await db.collection('restaurantprofiles').insertOne({
      restaurantId: String(application.userId || application._id),
      userId: application.userId,
      restaurantName: application.restaurantName,
      ownerName: application.ownerName,
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone,
      cuisine: application.cuisine || 'Not specified',
      address: application.address || 'Not provided',
      description: application.description || '',
      documents: application.documents || [],
      commissionRate: application.commissionRate ?? 18,
      status: 'APPROVED',
      approvedAt: now,
      createdAt: application.createdAt || now,
      updatedAt: now,
      __v: 0,
    });
    return;
  }

  await db.collection('restaurantprofiles').updateOne(
    { _id: existingProfile._id },
    {
      $set: {
        restaurantId: String(existingProfile.restaurantId || existingProfile.userId || existingProfile._id),
        status: 'APPROVED',
        approvedAt: existingProfile.approvedAt || now,
        updatedAt: now,
      },
    }
  );
}

/** Move leftover APPROVED applications into profiles and remove them from applications. */
async function cleanupApprovedApplications(db: Awaited<ReturnType<typeof getDb>>) {
  const approved = await db
    .collection('restaurantapplications')
    .find({ status: 'APPROVED' })
    .toArray();

  const now = new Date().toISOString();
  for (const application of approved) {
    await ensureRestaurantProfile(db, application, now);
    await syncUserApproval(db, application, 'APPROVED', now);
    await db.collection('restaurantapplications').deleteOne({ _id: application._id });
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
      .collection('restaurantapplications')
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
      { success: false, message: 'Unable to fetch restaurant applications', error: message },
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
    const application = await db.collection('restaurantapplications').findOne(filter);

    if (!application) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (status === 'APPROVED') {
      await ensureRestaurantProfile(db, application, now);
      await syncUserApproval(db, application, 'APPROVED', now);
      await db.collection('restaurantapplications').deleteOne(filter);

      return NextResponse.json({
        success: true,
        message:
          'Application approved. Moved to restaurant profiles and removed from applications. They can now log in.',
        application: mapApplication({ ...application, status: 'APPROVED' }),
      });
    }

    // REJECTED via PATCH (also supported via DELETE)
    await syncUserApproval(db, application, 'REJECTED', now);
    await db.collection('restaurantapplications').deleteOne(filter);

    return NextResponse.json({
      success: true,
      message:
        'Application rejected and removed from applications. User kept so they see a rejection message on login.',
      application: mapApplication({ ...application, status: 'REJECTED' }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to update application', error: message },
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
    const application = await db.collection('restaurantapplications').findOne(filter);

    if (!application) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    await syncUserApproval(db, application, 'REJECTED', now);
    await db.collection('restaurantapplications').deleteOne(filter);

    return NextResponse.json({
      success: true,
      message:
        'Restaurant application rejected and removed. User account kept for rejection login message.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to reject application', error: message },
      { status: 500 }
    );
  }
}
