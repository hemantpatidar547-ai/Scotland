'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Refund = {
    merchant_refund_id: string;
    cf_refund_id: string | null;
    amount: number;
    status: string;
    note: string | null;
    refund_arn: string | null;
    created_at: string;
    processed_at: string | null;
};

type PaymentDetails = {
    status: string;
    cashfreeOrderId: string;
    paymentId: string;
    paymentMethod: string;
    transactionId: string;
    paymentDate: string | null;
    paymentAmount: number;
    refundStatus: string | null;
    refundedAmount: number;
    reconciliationWarning: string | null;
    transactions: Array<{
        cf_payment_id: string;
        payment_status: string;
        payment_amount: number | null;
        payment_currency: string | null;
        payment_method: string | null;
        transaction_id: string | null;
        bank_reference: string | null;
        payment_time: string | null;
        payment_completion_time: string | null;
        payment_message: string | null;
    }>;
    refunds: Refund[];
};

const money = ( amount: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
} ).format( amount );

export default function CashfreePaymentManagement ( { orderId }: { orderId: string } )
{
    const [ payment, setPayment ] = useState<PaymentDetails | null>( null );
    const [ amount, setAmount ] = useState( '' );
    const [ note, setNote ] = useState( '' );
    const [ loading, setLoading ] = useState( true );
    const [ submitting, setSubmitting ] = useState( false );
    const [ error, setError ] = useState( '' );
    const [ notice, setNotice ] = useState( '' );
    const requestKey = useRef<{ amount: number; key: string } | null>( null);

    const loadDetails = useCallback( async () =>
    {
        setLoading( true );
        try
        {
            const response = await fetch( `/api/admin/orders/${ encodeURIComponent( orderId ) }/payments`, { cache: 'no-store' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not load payment details.' );
            setPayment( result.payment as PaymentDetails );
            setError( '' );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not load payment details.' );
        } finally
        {
            setLoading( false );
        }
    }, [ orderId ] );

    useEffect( () =>
    {
        void loadDetails();
    }, [ loadDetails ] );

    async function requestRefund ( refundAmount: number )
    {
        if ( !Number.isFinite( refundAmount ) || refundAmount <= 0 ) return;
        if ( !window.confirm( `Initiate a Cashfree refund of ${ money( refundAmount ) }? The payment will only be marked refunded after Cashfree confirms it.` ) ) return;

        setSubmitting( true );
        setNotice( '' );
        try
        {
            if ( !requestKey.current || requestKey.current.amount !== refundAmount )
                requestKey.current = { amount: refundAmount, key: crypto.randomUUID() };
            const response = await fetch( `/api/admin/orders/${ encodeURIComponent( orderId ) }/refunds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    amount: refundAmount,
                    idempotencyKey: requestKey.current.key,
                    note,
                } ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not submit the refund.' );
            requestKey.current = null;
            setNotice( `Cashfree refund status: ${ result.refundStatus }. Final status will update after provider confirmation.` );
            await loadDetails();
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not submit the refund.' );
            await loadDetails();
        } finally
        {
            setSubmitting( false );
        }
    }

    if ( loading ) return <p className="mt-5 text-sm text-zinc-500">Loading Cashfree payment details…</p>;
    if ( error && !payment ) return <p className="mt-5 text-sm text-rose-700" role="alert">{ error }</p>;
    if ( !payment ) return null;

    const reservedRefundAmount = payment.refunds
        .filter( refund => ![ 'FAILED', 'CANCELLED', 'REJECTED' ].includes( refund.status.toUpperCase() ) )
        .reduce( ( total, refund ) => total + Number( refund.amount ), 0 );
    const remaining = Math.max( 0, Number( payment.paymentAmount ) - reservedRefundAmount );
    const canRefund = [ 'paid', 'partially_refunded' ].includes( payment.status ) && remaining > 0;

    return (
        <section className="mt-6 border-t border-stone pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className="font-semibold">Cashfree payment management</h4>
                    <p className="mt-1 text-xs text-zinc-600">Payment status: <strong className="capitalize">{ payment.status.replaceAll( '_', ' ' ) }</strong></p>
                </div>
                <button type="button" className="text-xs underline" onClick={ () => void loadDetails() }>Refresh provider history</button>
            </div>

            { error && <p className="mt-3 text-sm text-rose-700" role="alert">{ error }</p> }
            { notice && <p className="mt-3 text-sm text-emerald-800" role="status">{ notice }</p> }
            { payment.reconciliationWarning && <p className="mt-3 text-sm text-amber-800" role="status">{ payment.reconciliationWarning }</p> }

            <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="font-semibold text-zinc-500">Payment amount</dt><dd>{ money( Number( payment.paymentAmount ) ) }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Payment date</dt><dd>{ payment.paymentDate ? new Date( payment.paymentDate ).toLocaleString( 'en-IN' ) : '—' }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Cashfree Order ID</dt><dd className="break-all">{ payment.cashfreeOrderId || '—' }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Payment ID</dt><dd className="break-all">{ payment.paymentId || '—' }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Payment method</dt><dd className="capitalize">{ ( payment.paymentMethod || '—' ).replaceAll( '_', ' ' ) }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Transaction / bank reference</dt><dd className="break-all">{ payment.transactionId || '—' }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Refunded amount</dt><dd>{ money( Number( payment.refundedAmount || 0 ) ) }</dd></div>
                <div><dt className="font-semibold text-zinc-500">Refund status</dt><dd className="capitalize">{ payment.refundStatus || 'Not refunded' }</dd></div>
            </dl>

            { payment.transactions.length > 0 && <div className="mt-5">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payment attempts</h5>
                <div className="mt-2 space-y-2">
                    { payment.transactions.map( transaction => (
                        <div key={ transaction.cf_payment_id } className="rounded border border-stone p-3 text-xs">
                            <p><strong>{ transaction.payment_status }</strong> · { transaction.payment_method || 'Payment method pending' } · { transaction.payment_amount === null ? '—' : money( Number( transaction.payment_amount ) ) }</p>
                            <p className="mt-1 break-all text-zinc-600">Cashfree Payment ID: { transaction.cf_payment_id }{ transaction.transaction_id ? ` · Ref: ${ transaction.transaction_id }` : '' }</p>
                            { transaction.payment_message && <p className="mt-1 text-zinc-500">{ transaction.payment_message }</p> }
                        </div>
                    ) ) }
                </div>
            </div> }

            { payment.refunds.length > 0 && <div className="mt-5">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Refund transaction history</h5>
                <div className="mt-2 space-y-2">
                    { payment.refunds.map( refund => (
                        <div key={ refund.merchant_refund_id } className="rounded border border-stone p-3 text-xs">
                            <p><strong>{ money( Number( refund.amount ) ) }</strong> · { refund.status } · { new Date( refund.created_at ).toLocaleString( 'en-IN' ) }</p>
                            <p className="mt-1 break-all text-zinc-600">Refund ID: { refund.cf_refund_id || refund.merchant_refund_id }</p>
                            { refund.refund_arn && <p className="mt-1 break-all text-zinc-600">ARN: { refund.refund_arn }</p> }
                            { refund.note && <p className="mt-1 text-zinc-500">{ refund.note }</p> }
                        </div>
                    ) ) }
                </div>
            </div> }

            { canRefund && <div className="mt-5 border-t border-stone pt-4">
                <p className="text-xs text-zinc-600">Remaining refundable amount: <strong>{ money( remaining ) }</strong></p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <input
                        type="number"
                        min="0.01"
                        max={ remaining }
                        step="0.01"
                        value={ amount }
                        onChange={ event => setAmount( event.target.value ) }
                        className="rounded border border-stone px-3 py-2 text-sm"
                        placeholder="Partial refund amount"
                        aria-label="Partial refund amount"
                    />
                    <input
                        type="text"
                        maxLength={ 200 }
                        value={ note }
                        onChange={ event => setNote( event.target.value ) }
                        className="rounded border border-stone px-3 py-2 text-sm"
                        placeholder="Refund note (optional)"
                        aria-label="Refund note"
                    />
                    <button
                        type="button"
                        disabled={ submitting || !Number.isFinite( Number( amount ) ) || Number( amount ) <= 0 || Number( amount ) > remaining }
                        onClick={ () => void requestRefund( Number( amount ) ) }
                        className="button-outline text-xs disabled:opacity-50"
                    >Partial refund</button>
                </div>
                <button
                    type="button"
                    disabled={ submitting }
                    onClick={ () => void requestRefund( remaining ) }
                    className="mt-3 text-xs font-semibold text-rose-700 underline disabled:opacity-50"
                >Full refund ({ money( remaining ) })</button>
            </div> }
        </section>
    );
}
