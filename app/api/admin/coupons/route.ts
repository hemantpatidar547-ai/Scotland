import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

async function requireAdmin ()
{
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if ( error || !user || user.email !== process.env.ADMIN_EMAIL ) return null;
    return user;
}

/* GET — list all coupons */
export async function GET ()
{
    if ( !await requireAdmin() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );
    const db = await getDb();
    const coupons = await db.collection( 'coupons' ).find( {} ).sort( { createdAt: -1 } ).toArray();
    return NextResponse.json( { data: coupons.map( c => ( { ...c, _id: c._id.toString() } ) ) } );
}

/* POST — create coupon */
export async function POST ( req: NextRequest )
{
    if ( !await requireAdmin() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const body = await req.json();
    const { code, discountType, discountValue, minimumOrderAmount, maximumDiscount, usageLimit, expiresAt } = body;

    if ( !code || !discountType || !discountValue )
        return NextResponse.json( { error: 'code, discountType, and discountValue are required' }, { status: 400 } );

    const db = await getDb();
    const existing = await db.collection( 'coupons' ).findOne( { code: code.toUpperCase() } );
    if ( existing ) return NextResponse.json( { error: 'Coupon code already exists' }, { status: 409 } );

    const coupon = {
        code: code.toUpperCase().trim(),
        discountType,       // 'percentage' | 'fixed'
        discountValue: Number( discountValue ),
        minimumOrderAmount: minimumOrderAmount ? Number( minimumOrderAmount ) : 0,
        maximumDiscount: maximumDiscount ? Number( maximumDiscount ) : null,
        usageLimit: usageLimit ? Number( usageLimit ) : null,
        usedCount: 0,
        isActive: true,
        expiresAt: expiresAt ? new Date( expiresAt ) : null,
        createdAt: new Date(),
    };

    const result = await db.collection( 'coupons' ).insertOne( coupon );
    return NextResponse.json( { success: true, id: result.insertedId.toString() } );
}

/* PATCH — toggle active / update */
export async function PATCH ( req: NextRequest )
{
    if ( !await requireAdmin() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { id, isActive } = await req.json();
    if ( !id ) return NextResponse.json( { error: 'id required' }, { status: 400 } );

    const db = await getDb();
    await db.collection( 'coupons' ).updateOne(
        { _id: new ObjectId( id ) },
        { $set: { isActive, updatedAt: new Date() } }
    );
    return NextResponse.json( { success: true } );
}

/* DELETE — remove coupon */
export async function DELETE ( req: NextRequest )
{
    if ( !await requireAdmin() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

    const { id } = await req.json();
    if ( !id ) return NextResponse.json( { error: 'id required' }, { status: 400 } );

    const db = await getDb();
    await db.collection( 'coupons' ).deleteOne( { _id: new ObjectId( id ) } );
    return NextResponse.json( { success: true } );
}
