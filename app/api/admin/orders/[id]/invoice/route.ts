import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';

export async function POST ( req: NextRequest, { params }: { params: Promise<{ id: string }> } )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const { id: orderId } = await params;
        const db = getSupabaseAdmin();

        // Check if order already has an invoice number
        const { data: currentOrder, error: fetchErr } = await db.from( 'orders' ).select( 'invoice_number' ).eq( 'id', orderId ).single();

        if ( fetchErr ) throw fetchErr;

        if ( currentOrder?.invoice_number )
        {
            return NextResponse.json( { success: true, invoiceNumber: currentOrder.invoice_number } );
        }

        // Count existing invoices to generate next number safely
        const { count, error: countErr } = await db.from( 'orders' )
            .select( '*', { count: 'exact', head: true } )
            .not( 'invoice_number', 'is', 'null' );

        if ( countErr ) throw countErr;

        const nextNumber = ( count || 0 ) + 1;
        const newInvoiceNumber = `SC-INV-${ String( nextNumber ).padStart( 6, '0' ) }`;

        // Attempt to update the order
        const { error: updateErr } = await db.from( 'orders' )
            .update( { invoice_number: newInvoiceNumber } )
            .eq( 'id', orderId );

        if ( updateErr )
        {
            console.error( updateErr );
            // If column doesn't exist, this will throw an error. 
            // The user must run ALTER TABLE orders ADD COLUMN invoice_number text;
            return NextResponse.json( { error: 'Failed to update. Make sure invoice_number column exists in Supabase.' }, { status: 500 } );
        }

        return NextResponse.json( { success: true, invoiceNumber: newInvoiceNumber } );
    } catch ( err )
    {
        console.error( 'Invoice generation error:', err );
        return NextResponse.json( { error: 'Failed to generate invoice' }, { status: 500 } );
    }
}
