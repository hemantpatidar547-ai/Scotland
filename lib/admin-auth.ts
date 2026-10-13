import { createClient } from '@/lib/supabase/ssr-server';
import { isAdminEmail } from '@/lib/admin-authorization';
import { getOTPUser } from '@/lib/jwt-auth';

const ADMIN_MOBILES = [
    process.env.ADMIN_MOBILE,
].filter( ( m ): m is string => Boolean( m ) );

function isAdminMobile ( mobile: string ): boolean
{
    return ADMIN_MOBILES.some( admin => admin.replace( /\D/g, '' ).slice( -10 ) === mobile );
}

export async function isAdminRequest (): Promise<boolean>
{
    // Check OTP session first
    const otpUser = await getOTPUser();
    if ( otpUser )
    {
        return otpUser.role === 'admin' || isAdminMobile( otpUser.mobile ) || isAdminEmail( otpUser.email );
    }

    // Fall back to Supabase
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        return !error && isAdminEmail( user?.email );
    } catch
    {
        return false;
    }
}
