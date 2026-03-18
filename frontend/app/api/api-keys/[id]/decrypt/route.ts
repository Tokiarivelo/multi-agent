import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const internalSecret = process.env.INTERNAL_SECRET || 'fallback_internal_secret_for_dev_mode';

    const res = await fetch(`${apiUrl}/api/api-keys/${id}/decrypt`, {
      headers: {
        'x-internal-secret': internalSecret,
        ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to decrypt key' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in proxy decrypt route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
