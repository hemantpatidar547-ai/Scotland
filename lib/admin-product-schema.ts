type DatabaseError = {
    code?: string;
    message?: string;
};

export function getAdminProductSchemaError ( error: DatabaseError | null | undefined ): string | null
{
    if ( !error ) return null;

    const message = error.message || '';
    const missingMetadataColumn =
        ( error.code === '42703' || error.code === 'PGRST204' ) &&
        message.toLowerCase().includes( 'product_metadata' );

    if ( !missingMetadataColumn ) return null;

    return 'Product database setup is incomplete. In Supabase SQL Editor, run the migration in supabase/migrations/0002_product_pricing_metadata.sql, then try again.';
}
