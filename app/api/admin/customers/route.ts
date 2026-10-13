import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';

const PAGE_SIZE = 25;
const terminalStatuses = new Set( [ 'cancelled', 'refunded' ] );

function parseDate ( value: string | null, endOfDay = false ): string | null
{
    if ( !value || !/^\d{4}-\d{2}-\d{2}$/.test( value ) ) return null;
    const date = new Date( `${ value }T00:00:00.000Z` );
    if ( Number.isNaN( date.getTime() ) ) return null;
    if ( endOfDay ) date.setUTCDate( date.getUTCDate() + 1 );
    return date.toISOString();
}

export async function GET ( request: NextRequest )
{
    try
    {
        if ( !await isAdminRequest() ) return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const db = getSupabaseAdmin();
        const params = request.nextUrl.searchParams;
        const page = Math.max( 1, Math.min( 100000, Number.parseInt( params.get( 'page' ) || '1', 10 ) || 1 ) );
        const search = ( params.get( 'search' ) || '' ).trim().replace( /[%_,()]/g, ' ' ).slice( 0, 100 );
        const from = parseDate( params.get( 'from' ) );
        const toExclusive = parseDate( params.get( 'to' ), true );

        let customersQuery = db.from( 'profiles' )
            .select( 'id, email, full_name, phone, created_at', { count: 'exact' } )
            .eq( 'role', 'customer' )
            .order( 'created_at', { ascending: false } );

        if ( search )
        {
            customersQuery = customersQuery.or(
                `email.ilike.%${ search }%,full_name.ilike.%${ search }%,phone.ilike.%${ search }%`
            );
        }
        if ( from ) customersQuery = customersQuery.gte( 'created_at', from );
        if ( toExclusive ) customersQuery = customersQuery.lt( 'created_at', toExclusive );

        const start = ( page - 1 ) * PAGE_SIZE;
        const { data: profileRows, count, error: profilesError } = await customersQuery.range( start, start + PAGE_SIZE - 1 );
        if ( profilesError ) throw profilesError;

        const customerIds = ( profileRows || [] ).map( profile => profile.id );
        const [ ordersResult, totalCustomersResult, todayCountResult, monthCountResult ] = await Promise.all( [
            customerIds.length
                ? db.from( 'orders' )
                    .select( 'id, user_id, user_email, shipping_address, order_number, created_at, order_status, payment_status, final_amount, total_amount' )
                    .in( 'user_id', customerIds )
                    .order( 'created_at', { ascending: false } )
                : Promise.resolve( { data: [], error: null } ),
            db.from( 'profiles' ).select( 'id', { count: 'exact', head: true } ).eq( 'role', 'customer' ),
            db.from( 'profiles' ).select( 'id', { count: 'exact', head: true } ).eq( 'role', 'customer' ).gte( 'created_at', new Date( new Date().setUTCHours( 0, 0, 0, 0 ) ).toISOString() ),
            db.from( 'profiles' ).select( 'id', { count: 'exact', head: true } ).eq( 'role', 'customer' ).gte( 'created_at', new Date( Date.UTC( new Date().getUTCFullYear(), new Date().getUTCMonth(), 1 ) ).toISOString() ),
        ] );
        if ( ordersResult.error ) throw ordersResult.error;
        if ( totalCustomersResult.error ) throw totalCustomersResult.error;
        if ( todayCountResult.error ) throw todayCountResult.error;
        if ( monthCountResult.error ) throw monthCountResult.error;

        const ordersByUser = new Map<string, typeof ordersResult.data>();
        for ( const order of ordersResult.data || [] )
        {
            if ( !order.user_id ) continue;
            const orders = ordersByUser.get( order.user_id ) || [];
            orders.push( order );
            ordersByUser.set( order.user_id, orders );
        }

        const customers = ( profileRows || [] ).map( profile =>
        {
            const orders = ordersByUser.get( profile.id ) || [];
            const customerOrders = orders.map( order => ( {
                id: order.id,
                orderNumber: order.order_number,
                createdAt: order.created_at,
                orderStatus: order.order_status,
                paymentStatus: order.payment_status,
                total: Number( order.final_amount ?? order.total_amount ?? 0 ),
            } ) );
            return {
                userId: profile.id,
                name: profile.full_name || orders[ 0 ]?.shipping_address?.name || '',
                email: profile.email || orders[ 0 ]?.user_email || '',
                phone: profile.phone || orders[ 0 ]?.shipping_address?.phone || '',
                registeredAt: profile.created_at,
                orderCount: customerOrders.length,
                completedOrders: customerOrders.filter( order => order.orderStatus === 'delivered' ).length,
                pendingOrders: customerOrders.filter( order => !terminalStatuses.has( order.orderStatus ) && order.orderStatus !== 'delivered' ).length,
                cancelledOrders: customerOrders.filter( order => order.orderStatus === 'cancelled' ).length,
                totalSpent: customerOrders.reduce(
                    ( total, order ) => total + ( terminalStatuses.has( order.orderStatus ) ? 0 : order.total ),
                    0
                ),
                lastOrderAt: customerOrders[ 0 ]?.createdAt || null,
                orders: customerOrders,
            };
        } );

        const total = count || 0;
        return NextResponse.json( {
            data: customers,
            pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil( total / PAGE_SIZE ) },
            summary: {
                totalCustomers: totalCustomersResult.count || 0,
                newToday: todayCountResult.count || 0,
                newThisMonth: monthCountResult.count || 0,
            },
        } );
    } catch ( error )
    {
        console.error( 'Admin customers query failed:', error );
        return NextResponse.json( { error: 'Could not load customer management data.' }, { status: 500 } );
    }
}
