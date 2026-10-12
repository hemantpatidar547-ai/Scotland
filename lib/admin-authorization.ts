const ADMIN_EMAILS = [
    'patidarhemant226@gmail.com',
    'hemantpatidar547@gmail.com',
    process.env.ADMIN_EMAIL,
].filter( ( email ): email is string => Boolean( email ) );

export function isAdminEmail ( email: string | null | undefined ): boolean
{
    if ( !email ) return false;

    const normalizedEmail = email.trim().toLowerCase();
    return ADMIN_EMAILS.some( adminEmail => adminEmail.trim().toLowerCase() === normalizedEmail );
}
