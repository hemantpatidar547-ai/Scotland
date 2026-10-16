import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { isAdminRequest } from '@/lib/admin-auth';

/* GET — list all coupons */
export async function GET ()
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const db = getSupabaseAdmin();
    const { data: coupons } = await db.from( 'coupons' ).select( '*' ).order( 'created_at', { ascending: false } );
    return NextResponse.json( { data: coupons || [] } );
}

/* POST — create coupon */
export async function POST ( req: NextRequest )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const body = await req.json();
    const { code, discountType, discountValue, minimumOrderAmount, maximumDiscount, usageLimit, expiresAt } = body;

    if ( !code || !discountType || !discountValue )
        return NextResponse.json( { error: 'code, discountType, and discountValue are required' }, { status: 400 } );

    const db = getSupabaseAdmin();
    const { data: existing } = await db.from( 'coupons' ).select( 'id' ).eq( 'code', code.toUpperCase() ).single();
    if ( existing ) return NextResponse.json( { error: 'Coupon code already exists' }, { status: 409 } );

    const { data, error } = await db.from( 'coupons' ).insert( {
        code: code.toUpperCase().trim(),
        discount_type: discountType,
        discount_value: Number( discountValue ),
        minimum_order_amount: minimumOrderAmount ? Number( minimumOrderAmount ) : 0,
        maximum_discount: maximumDiscount ? Number( maximumDiscount ) : null,
        usage_limit: usageLimit ? Number( usageLimit ) : null,
        used_count: 0,
        is_active: true,
        expires_at: expiresAt ? new Date( expiresAt ).toISOString() : null,
    } ).select().single();

    if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
    return NextResponse.json( { success: true, id: data.id } );
}

/* PATCH — toggle active */
export async function PATCH ( req: NextRequest )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { id, isActive } = await req.json();
    if ( !id ) return NextResponse.json( { error: 'id required' }, { status: 400 } );

    const db = getSupabaseAdmin();
    const { error } = await db.from( 'coupons' ).update( { is_active: isActive } ).eq( 'id', id );
    if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
    return NextResponse.json( { success: true } );
}

/* DELETE — remove coupon */
export async function DELETE ( req: NextRequest )
{
    if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { id } = await req.json();
    if ( !id ) return NextResponse.json( { error: 'id required' }, { status: 400 } );

    const db = getSupabaseAdmin();
    const { error } = await db.from( 'coupons' ).delete().eq( 'id', id );
    if ( error ) return NextResponse.json( { error: error.message }, { status: 500 } );
    return NextResponse.json( { success: true } );
}
