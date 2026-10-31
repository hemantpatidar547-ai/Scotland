import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { enforceRateLimit } from '@/lib/rate-limit';

/* ── POST /api/coupons/validate ─── */
export async function POST ( req: NextRequest )
{
    try
    {
        const rateLimitResponse = await enforceRateLimit( req, {
            scope: 'coupon-validate',
            limit: 30,
            windowSeconds: 60,
        } );
        if ( rateLimitResponse ) return rateLimitResponse;

        const { code, cartTotal } = await req.json();
        if ( !code ) return NextResponse.json( { error: 'Coupon code is required' }, { status: 400 } );

        const db = getSupabaseAdmin();
        const { data: coupon } = await db.from( 'coupons' ).select( '*' ).eq( 'code', code.toUpperCase() ).single();

        if ( !coupon ) return NextResponse.json( { error: 'Invalid coupon code' }, { status: 404 } );
        if ( !coupon.is_active ) return NextResponse.json( { error: 'This coupon is no longer active' }, { status: 400 } );

        const now = new Date();
        if ( coupon.expires_at && new Date( coupon.expires_at ) < now )
            return NextResponse.json( { error: 'This coupon has expired' }, { status: 400 } );

        if ( coupon.usage_limit && coupon.used_count >= coupon.usage_limit )
            return NextResponse.json( { error: 'Coupon usage limit reached' }, { status: 400 } );

        if ( coupon.minimum_order_amount && cartTotal < coupon.minimum_order_amount )
            return NextResponse.json( { error: `Minimum order amount is ₹${ coupon.minimum_order_amount }` }, { status: 400 } );

        let discount = 0;
        if ( coupon.discount_type === 'percentage' )
        {
            discount = Math.round( cartTotal * ( coupon.discount_value / 100 ) );
            if ( coupon.maximum_discount ) discount = Math.min( discount, coupon.maximum_discount );
        } else
        {
            discount = coupon.discount_value;
        }

        return NextResponse.json( {
            success: true,
            code: coupon.code,
            discount,
            discountType: coupon.discount_type,
            message: `Coupon applied! You save ₹${ discount.toLocaleString( 'en-IN' ) }`,
        } );
    } catch ( err )
    {
        console.error( 'Coupon validate error:', err );
        return NextResponse.json( { error: 'Failed to validate coupon' }, { status: 500 } );
    }
}
