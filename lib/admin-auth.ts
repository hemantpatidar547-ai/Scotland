import { cookies } from 'next/headers';
import { getAdminSessionCookieName, verifyAdminSession } from '@/lib/admin-session';

export async function isAdminRequest (): Promise<boolean>
{
    try
    {
        const cookieStore = await cookies();
        return await verifyAdminSession( cookieStore.get( getAdminSessionCookieName() )?.value );
    } catch
    {
        return false;
    }
}
