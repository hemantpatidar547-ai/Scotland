import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/db';
import { getDelhiveryConfig } from '@/lib/delhivery/config';

type JsonRecord = Record<string, unknown>;

function isRecord ( value: unknown ): value is JsonRecord
{
    return Boolean( value ) && typeof value === 'object' && !Array.isArray( value );
}

function getWaybill ( value: unknown ): string | null
{
    if ( !isRecord( value ) ) return null;
    if ( typeof value.waybill === 'string' && value.waybill.trim() ) return value.waybill.trim();
    if ( Array.isArray( value.packages ) )
    {
        const firstPackage = value.packages.find( isRecord );
        if ( firstPackage && typeof firstPackage.waybill === 'string' && firstPackage.waybill.trim() )
            return firstPackage.waybill.trim();
    }
    return null;
}

async function updateSubmissionAudit ( auditId: string, orderId: string, apiResult: JsonRecord ): Promise<boolean>
{
    const { error } = await getSupabaseAdmin().from( 'courier_submission_audit' )
        .update( { api_result: apiResult } )
        .eq( 'id', auditId );
    if ( error )
    {
        console.error( 'Could not update courier submission audit result for order:', orderId );
        return false;
    }
    return true;
}

async function markSubmissionNeedsReview ( orderId: string, message: string )
{
    const { error } = await getSupabaseAdmin().from( 'orders' )
        .update( {
            courier_api_submission_state: 'needs_review',
            courier_api_submission_error: message.slice( 0, 500 ),
            updated_at: new Date().toISOString(),
        } )
        .eq( 'id', orderId )
        .eq( 'courier_api_submission_state', 'submitting' );
    if ( error ) throw error;
}

export async function POST ( req: NextRequest, { params }: { params: Promise<{ id: string }> } )
{
    try
    {
        if ( !await isAdminRequest() )
            return NextResponse.json( { error: 'Unauthorized' }, { status: 401 } );

        const adminId = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        if ( !adminId )
            return NextResponse.json( { error: 'Courier submission auditing is not configured.' }, { status: 503 } );

        const origin = req.headers.get( 'origin' );
        if ( origin && origin !== req.nextUrl.origin )
            return NextResponse.json( { error: 'Invalid request origin.' }, { status: 403 } );

        let body: unknown;
        try
        {
            body = await req.json();
        } catch
        {
            return NextResponse.json( { error: 'Request body must be valid JSON.' }, { status: 400 } );
        }
        if ( !isRecord( body ) || typeof body.weightGrams !== 'number' ||
            !Number.isSafeInteger( body.weightGrams ) || body.weightGrams < 1 || body.weightGrams > 100000 )
        {
            return NextResponse.json( { error: 'Enter the packed parcel weight in grams (1–100000).' }, { status: 400 } );
        }

        const { id } = await params;
        const db = getSupabaseAdmin();
        const { data: order, error: readError } = await db.from( 'orders' )
            .select( 'id, order_number, order_status, payment_status, payment_method, final_amount, total_amount, shipping_address, items, courier_dispatch_queued, courier_api_submission_state, tracking_number, return_status' )
            .eq( 'id', id )
            .is( 'admin_archived_at', null )
            .maybeSingle();

        if ( readError ) throw readError;
        if ( !order ) return NextResponse.json( { error: 'Order not found.' }, { status: 404 } );
        if ( !order.courier_dispatch_queued )
            return NextResponse.json( { error: 'Confirm this order for courier in Order Management before submitting it.' }, { status: 409 } );
        if ( order.tracking_number || order.courier_api_submission_state !== 'pending' )
            return NextResponse.json( { error: 'This shipment has already been submitted or needs review. Do not retry until its status is checked in Delhivery.' }, { status: 409 } );
        if ( [ 'cancelled', 'refunded', 'delivered', 'returned', 'shipped', 'out_for_delivery' ].includes( String( order.order_status ).toLowerCase() ) )
            return NextResponse.json( { error: 'This order is not eligible for a new courier shipment.' }, { status: 409 } );
        if ( order.return_status )
            return NextResponse.json( { error: 'An order with a return request cannot be submitted as a new shipment.' }, { status: 409 } );

        const paymentMethod = String( order.payment_method || '' ).toLowerCase();
        const isCod = paymentMethod === 'cod';
        if ( !isCod && String( order.payment_status || '' ).toLowerCase() !== 'paid' )
            return NextResponse.json( { error: 'Complete online payment before sending this shipment.' }, { status: 409 } );

        const address = isRecord( order.shipping_address ) ? order.shipping_address : null;
        const name = typeof address?.name === 'string' ? address.name.trim() : '';
        const streetAddress = typeof address?.address === 'string' ? address.address.trim() : '';
        const city = typeof address?.city === 'string' ? address.city.trim() : '';
        const state = typeof address?.state === 'string' ? address.state.trim() : '';
        const pin = typeof address?.postalCode === 'string' ? address.postalCode.replace( /\D/g, '' ) : '';
        const phone = typeof address?.phone === 'string' ? address.phone.replace( /\D/g, '' ) : '';
        const country = typeof address?.country === 'string' ? address.country.trim() : 'India';
        if ( !name || !streetAddress || !city || country.toLowerCase() !== 'india' || !/^\d{6}$/.test( pin ) || phone.length < 10 || phone.length > 15 )
            return NextResponse.json( { error: 'The order needs a valid Indian delivery name, address, city, 6-digit pincode, and phone number.' }, { status: 400 } );

        const items = Array.isArray( order.items ) ? order.items.filter( isRecord ) : [];
        const productsDescription = items
            .map( item => typeof item.name === 'string' ? item.name.trim() : '' )
            .filter( Boolean )
            .join( ', ' )
            .slice( 0, 250 );
        const quantity = items.reduce( ( total, item ) =>
        {
            const itemQuantity = Number( item.quantity );
            return total + ( Number.isSafeInteger( itemQuantity ) && itemQuantity > 0 ? itemQuantity : 0 );
        }, 0 );
        const amount = Number( order.final_amount ?? order.total_amount );
        if ( !productsDescription || quantity < 1 || !Number.isFinite( amount ) || amount <= 0 )
            return NextResponse.json( { error: 'The order is missing valid product or amount details for courier submission.' }, { status: 400 } );

        const config = getDelhiveryConfig();
        const baseUrl = new URL( config.apiBaseUrl );
        if ( baseUrl.hostname.toLowerCase() !== 'staging-express.delhivery.com' || ![ '', '/' ].includes( baseUrl.pathname ) )
            return NextResponse.json( {
                error: 'Sandbox-only shipment creation is enabled. Set DELHIVERY_API_BASE_URL to https://staging-express.delhivery.com before testing.',
            }, { status: 503 } );

        const { data: reservedOrder, error: reserveError } = await db.from( 'orders' )
            .update( {
                courier_api_submission_state: 'submitting',
                courier_api_submission_error: null,
                courier_package_weight_g: body.weightGrams,
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', id )
            .eq( 'courier_dispatch_queued', true )
            .eq( 'courier_api_submission_state', 'pending' )
            .is( 'tracking_number', null )
            .is( 'admin_archived_at', null )
            .select( 'id' )
            .maybeSingle();

        if ( reserveError ) throw reserveError;
        if ( !reservedOrder )
            return NextResponse.json( { error: 'This shipment changed while you were submitting it. Refresh and check its current status.' }, { status: 409 } );

        const { data: auditEntry, error: auditInsertError } = await db.from( 'courier_submission_audit' )
            .insert( {
                admin_id: adminId,
                order_id: id,
                action: 'shipment_submission',
                api_result: { outcome: 'started' },
            } )
            .select( 'id' )
            .single();

        if ( auditInsertError )
        {
            const { error: releaseError } = await db.from( 'orders' )
                .update( {
                    courier_api_submission_state: 'pending',
                    courier_api_submission_error: null,
                    updated_at: new Date().toISOString(),
                } )
                .eq( 'id', id )
                .eq( 'courier_api_submission_state', 'submitting' )
                .is( 'tracking_number', null );
            if ( releaseError ) console.error( 'Could not release courier submission reservation:', id );
            console.error( 'Could not record courier submission audit entry:', id );
            return NextResponse.json( { error: 'The submission could not be recorded, so it was not sent. Try again later.' }, { status: 503 } );
        }

        const shipment: JsonRecord = {
            name,
            add: streetAddress,
            pin,
            city,
            state,
            country,
            phone,
            order: String( order.order_number ),
            payment_mode: isCod ? 'COD' : 'Prepaid',
            products_desc: productsDescription,
            quantity: String( quantity ),
            total_amount: String( amount ),
            weight: String( body.weightGrams ),
            shipping_mode: 'Surface',
        };
        if ( isCod ) shipment.cod_amount = String( amount );
        const requestBody = new URLSearchParams( {
            format: 'json',
            data: JSON.stringify( {
                shipments: [ shipment ],
                pickup_location: { name: config.pickupLocation },
            } ),
        } );

        let carrierResponse: Response;
        let carrierResult: unknown;
        try
        {
            carrierResponse = await fetch( `${ baseUrl.origin }/api/cmu/create.json`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Token ${ config.apiToken }`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: requestBody,
                cache: 'no-store',
                signal: AbortSignal.timeout( 20000 ),
            } );
            carrierResult = await carrierResponse.json();
        } catch
        {
            console.error( 'Delhivery sandbox request outcome is unknown for order:', id );
            await markSubmissionNeedsReview( id, 'The request timed out or the response could not be read. Check the Delhivery dashboard before retrying.' );
            await updateSubmissionAudit( auditEntry.id, id, { outcome: 'unknown' } );
            return NextResponse.json( {
                error: 'Delhivery response could not be confirmed. Check the sandbox dashboard before retrying to avoid duplicate shipments.',
            }, { status: 502 } );
        }

        const waybill = getWaybill( carrierResult );
        if ( !carrierResponse.ok || !waybill )
        {
            await markSubmissionNeedsReview( id, 'Delhivery did not confirm a waybill. Check the sandbox dashboard before retrying.' );
            await updateSubmissionAudit( auditEntry.id, id, {
                outcome: 'not_confirmed',
                httpStatus: carrierResponse.status,
            } );
            return NextResponse.json( {
                error: 'Delhivery did not confirm a shipment. Check the sandbox dashboard before retrying to avoid duplicates.',
            }, { status: 502 } );
        }

        const { data: savedOrder, error: saveError } = await db.from( 'orders' )
            .update( {
                courier_name: 'Delhivery',
                tracking_number: waybill,
                courier_status: 'Manifested',
                courier_status_updated_at: new Date().toISOString(),
                courier_api_submission_state: 'submitted',
                courier_api_submission_error: null,
                courier_dispatch_queued: false,
                updated_at: new Date().toISOString(),
            } )
            .eq( 'id', id )
            .eq( 'courier_api_submission_state', 'submitting' )
            .is( 'tracking_number', null )
            .is( 'admin_archived_at', null )
            .select( 'id' )
            .maybeSingle();

        if ( saveError ) throw saveError;
        if ( !savedOrder )
        {
            await updateSubmissionAudit( auditEntry.id, id, {
                outcome: 'created_order_update_failed',
                httpStatus: carrierResponse.status,
                waybill,
            } );
            return NextResponse.json( {
                error: `Delhivery created waybill ${ waybill }, but the order record could not be updated. Do not resubmit; contact support to reconcile it.`,
            }, { status: 503 } );
        }

        const auditRecorded = await updateSubmissionAudit( auditEntry.id, id, {
            outcome: 'created',
            httpStatus: carrierResponse.status,
            waybill,
        } );
        return NextResponse.json( { success: true, sandbox: true, waybill, auditRecorded } );
    } catch ( error )
    {
        console.error( 'Delhivery sandbox shipment processing failed.' );
        if ( error instanceof Error && error.message.startsWith( 'Delhivery sandbox is not configured.' ) )
            return NextResponse.json( { error: error.message }, { status: 503 } );
        if (
            error && typeof error === 'object' &&
            'code' in error &&
            ( error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200' )
        )
        {
            return NextResponse.json( {
                error: 'Courier submission or audit fields are not installed yet. Apply migrations 0017 and 0018.',
            }, { status: 503 } );
        }
        return NextResponse.json( { error: 'Could not submit the shipment to Delhivery sandbox.' }, { status: 500 } );
    }
}
