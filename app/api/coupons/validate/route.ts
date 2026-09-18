import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/* ── POST /api/coupons/validate ─── */
export async function POST ( req: NextRequest )
{
    try
    {
        const { code, cartTotal } = await req.json();

        if ( !code ) return NextResponse.json( { error: 'Coupon code is required' }, { status: 400 } );

        const db = await getDb();
        const coupon = await db.collection( 'coupons' ).findOne( { code: code.toUpperCase() } );

        if ( !coupon )
            return NextResponse.json( { error: 'Invalid coupon code' }, { status: 404 } );

        if ( !coupon.isActive )
            return NextResponse.json( { error: 'This coupon is no longer active' }, { status: 400 } );

        const now = new Date();
        if ( coupon.expiresAt && new Date( coupon.expiresAt ) < now )
            return NextResponse.json( { error: 'This coupon has expired' }, { status: 400 } );

        if ( coupon.startsAt && new Date( coupon.startsAt ) > now )
            return NextResponse.json( { error: 'This coupon is not yet valid' }, { status: 400 } );

        if ( coupon.usageLimit && coupon.usedCount >= coupon.usageLimit )
            return NextResponse.json( { error: 'Coupon usage limit reached' }, { status: 400 } );

        if ( coupon.minimumOrderAmount && cartTotal < coupon.minimumOrderAmount )
            return NextResponse.json( { error: `Minimum order amount is ₹${ coupon.minimumOrderAmount }` }, { status: 400 } );

        /* Calculate discount */
        let discount = 0;
        if ( coupon.discountType === 'percentage' )
        {
            discount = Math.round( cartTotal * ( coupon.discountValue / 100 ) );
            if ( coupon.maximumDiscount ) discount = Math.min( discount, coupon.maximumDiscount );
        }
        else
        {
            discount = coupon.discountValue;
        }

        return NextResponse.json( {
            success: true,
            code: coupon.code,
            discount,
            discountType: coupon.discountType,
            message: `Coupon applied! You save ₹${ discount.toLocaleString( 'en-IN' ) }`,
        } );
    }
    catch ( err )
    {
        console.error( 'Coupon validate error:', err );
        return NextResponse.json( { error: 'Failed to validate coupon' }, { status: 500 } );
    }
}
