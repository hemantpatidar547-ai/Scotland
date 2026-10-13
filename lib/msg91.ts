/**
 * MSG91 OTP Service
 * Handles sending, verifying, and resending OTP via MSG91 API.
 */

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '';
const MSG91_BASE_URL = 'https://control.msg91.com/api/v5';

function formatMobile ( mobile: string ): string
{
    // Remove all non-digits
    const digits = mobile.replace( /\D/g, '' );
    // Ensure country code (91 for India)
    if ( digits.length === 10 ) return `91${ digits }`;
    if ( digits.startsWith( '91' ) && digits.length === 12 ) return digits;
    return digits;
}

export function validateMobileNumber ( mobile: string ): boolean
{
    const digits = mobile.replace( /\D/g, '' );
    // Indian mobile: 10 digits starting with 6-9
    if ( digits.length === 10 ) return /^[6-9]\d{9}$/.test( digits );
    if ( digits.length === 12 && digits.startsWith( '91' ) ) return /^91[6-9]\d{9}$/.test( digits );
    return false;
}

export async function sendOTP ( mobile: string ): Promise<{ success: boolean; message: string; requestId?: string }>
{
    if ( !MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID )
    {
        console.error( 'MSG91 configuration missing: AUTH_KEY or TEMPLATE_ID' );
        return { success: false, message: 'OTP service is not configured. Please contact support.' };
    }

    const formattedMobile = formatMobile( mobile );

    try
    {
        const response = await fetch(
            `${ MSG91_BASE_URL }/otp?template_id=${ MSG91_TEMPLATE_ID }&mobile=${ formattedMobile }`,
            {
                method: 'POST',
                headers: {
                    'authkey': MSG91_AUTH_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = await response.json();

        if ( data.type === 'success' || response.ok )
        {
            return {
                success: true,
                message: 'OTP sent successfully.',
                requestId: data.request_id,
            };
        }

        console.error( 'MSG91 sendOTP failed:', data );
        return { success: false, message: data.message || 'Could not send OTP. Please try again.' };
    } catch ( error )
    {
        console.error( 'MSG91 sendOTP error:', error );
        return { success: false, message: 'OTP service is temporarily unavailable.' };
    }
}

export async function verifyOTP ( mobile: string, otp: string ): Promise<{ success: boolean; message: string }>
{
    if ( !MSG91_AUTH_KEY )
    {
        return { success: false, message: 'OTP service is not configured.' };
    }

    const formattedMobile = formatMobile( mobile );

    try
    {
        const response = await fetch(
            `${ MSG91_BASE_URL }/otp/verify?mobile=${ formattedMobile }&otp=${ otp }`,
            {
                method: 'POST',
                headers: {
                    'authkey': MSG91_AUTH_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = await response.json();

        if ( data.type === 'success' || data.message === 'OTP verified success' )
        {
            return { success: true, message: 'OTP verified successfully.' };
        }

        return { success: false, message: data.message || 'Invalid OTP. Please try again.' };
    } catch ( error )
    {
        console.error( 'MSG91 verifyOTP error:', error );
        return { success: false, message: 'Could not verify OTP. Please try again.' };
    }
}

export async function resendOTP ( mobile: string, retryType: 'text' | 'voice' = 'text' ): Promise<{ success: boolean; message: string }>
{
    if ( !MSG91_AUTH_KEY )
    {
        return { success: false, message: 'OTP service is not configured.' };
    }

    const formattedMobile = formatMobile( mobile );

    try
    {
        const response = await fetch(
            `${ MSG91_BASE_URL }/otp/retry?mobile=${ formattedMobile }&retrytype=${ retryType }`,
            {
                method: 'POST',
                headers: {
                    'authkey': MSG91_AUTH_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = await response.json();

        if ( data.type === 'success' || response.ok )
        {
            return { success: true, message: retryType === 'voice' ? 'OTP sent via call.' : 'OTP resent successfully.' };
        }

        return { success: false, message: data.message || 'Could not resend OTP.' };
    } catch ( error )
    {
        console.error( 'MSG91 resendOTP error:', error );
        return { success: false, message: 'Could not resend OTP. Please try again.' };
    }
}
