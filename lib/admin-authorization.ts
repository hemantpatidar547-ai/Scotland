export function isAdminEmail ( email: string | null | undefined ): boolean
{
    if ( !email ) return false;

    const normalizedEmail = email.trim().toLowerCase();
    const configuredEmails = [
        process.env.ADMIN_EMAIL || '',
        ...( process.env.ADMIN_EMAILS || '' ).split( ',' ),
    ].map( adminEmail => adminEmail.trim().toLowerCase() ).filter( Boolean );

    return configuredEmails.includes( normalizedEmail );
}
