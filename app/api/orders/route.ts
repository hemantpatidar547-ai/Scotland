import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/ssr-server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/* ── helpers ─────────────────────────────────── */
function money ( n: number )
{
    return new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );
}

/* ── POST /api/orders  (create order) ─────────── */
export async function POST ( req: NextRequest )
{
    try
    {
        /* 1. Auth */
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if ( error || !user ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const body = await req.json();
        const {
            cartItems,          // [{ productId, name, image, size, color, quantity, price }]
            shippingAddress,    // { name, email, phone, address, city, state, postalCode, country }
            paymentMethod,      // 'cod' | 'razorpay'
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
            couponCode,
            couponDiscount = 0,
        } = body;

        if ( !cartItems?.length ) return NextResponse.json( { error: 'Cart is empty' }, { status: 400 } );
        if ( !shippingAddress ) return NextResponse.json( { error: 'Shipping address required' }, { status: 400 } );

        const db = await getDb();

        /* 2. Validate prices server-side (never trust client prices) */
        const productIds = cartItems.map( ( i: any ) => i.productId ).filter( Boolean );
        const dbProducts = await db.collection( 'products' ).find( { _id: { $in: productIds.map( ( id: string ) => { try { return new ObjectId( id ) } catch { return null } } ).filter( Boolean ) } } ).toArray();
        const dbProductsMap = new Map( dbProducts.map( p => [ p._id.toString(), p ] ) );

        let subtotal = 0;
        const validatedItems = cartItems.map( ( item: any ) =>
        {
            const dbP = dbProductsMap.get( item.productId );
            const price = dbP ? Number( dbP.salePrice || dbP.price ) : Number( item.price );
            subtotal += price * item.quantity;
            return {
                productId: item.productId,
                name: item.name,
                image: item.image,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
                price,
                totalPrice: price * item.quantity,
            };
        } );

        /* 3. Shipping */
        const shippingCost = subtotal >= 4000 ? 0 : 250;

        /* 4. Tax (example: 5% GST) */
        const tax = Math.round( subtotal * 0.05 );

        /* 5. Final amount */
        const finalAmount = subtotal + shippingCost + tax - couponDiscount;

        /* 6. Generate order number */
        const orderCount = await db.collection( 'orders' ).countDocuments();
        const orderNumber = `SC-${ String( 100000 + orderCount + 1 ) }`;

        /* 7. Build order document */
        const orderDoc = {
            orderNumber,
            userId: user.id,
            userEmail: user.email,
            shippingAddress,
            items: validatedItems,
            subtotal,
            shippingCost,
            tax,
            couponCode: couponCode || null,
            couponDiscount,
            finalAmount,
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
            razorpayPaymentId: razorpayPaymentId || null,
            razorpayOrderId: razorpayOrderId || null,
            razorpaySignature: razorpaySignature || null,
            orderStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection( 'orders' ).insertOne( orderDoc );

        /* 8. Reduce stock (best-effort) */
        for ( const item of validatedItems )
        {
            try
            {
                await db.collection( 'products' ).updateOne(
                    { _id: new ObjectId( item.productId ) },
                    { $inc: { stock: -item.quantity } }
                );
            } catch ( _e ) { /* ignore if product not in MongoDB */ }
        }

        /* 9. Mark coupon as used (best-effort) */
        if ( couponCode )
        {
            await db.collection( 'coupons' ).updateOne(
                { code: couponCode.toUpperCase() },
                { $inc: { usedCount: 1 } }
            );
        }

        return NextResponse.json( {
            success: true,
            orderId: result.insertedId.toString(),
            orderNumber,
            finalAmount,
        } );
    }
    catch ( err )
    {
        console.error( 'Order creation error:', err );
        return NextResponse.json( { error: 'Failed to create order' }, { status: 500 } );
    }
}

/* ── GET /api/orders  (list orders for logged-in user) ─── */
export async function GET ()
{
    try
    {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if ( error || !user ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = await getDb();
        const orders = await db.collection( 'orders' )
            .find( { userId: user.id } )
            .sort( { createdAt: -1 } )
            .toArray();

        return NextResponse.json( { data: orders.map( o => ( { ...o, _id: o._id.toString() } ) ) } );
    }
    catch ( err )
    {
        console.error( 'Fetch orders error:', err );
        return NextResponse.json( { error: 'Failed to fetch orders' }, { status: 500 } );
    }
}
