import React, { useState } from 'react';

type BillingItem = {
    name?: string;
    size?: string;
    color?: string;
    quantity?: number;
    price?: number;
    totalPrice?: number;
};

type BillingOrder = {
    _id: string;
    invoiceNumber?: string | null;
    orderNumber: string;
    createdAt: string;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    shippingAddress?: Record<string, string | undefined> | null;
    userEmail?: string | null;
    items?: BillingItem[];
    subtotal?: number | null;
    shippingCost?: number | null;
    couponDiscount?: number | null;
    tax?: number | null;
    finalAmount?: number | null;
};

const money = ( n: number ) => new Intl.NumberFormat( 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
} ).format( Number.isFinite( n ) ? n : 0 );

const escapeHtml = ( value: unknown ) => String( value ?? '' )
    .replaceAll( '&', '&amp;' )
    .replaceAll( '<', '&lt;' )
    .replaceAll( '>', '&gt;' )
    .replaceAll( '"', '&quot;' )
    .replaceAll( "'", '&#39;' );

const lineTotal = ( item: BillingItem ) => Number(
    item.totalPrice ?? Number( item.price || 0 ) * Number( item.quantity || 1 )
);

export default function BillingActions ( { order, onInvoiceGenerated }: { order: BillingOrder, onInvoiceGenerated: () => void } )
{
    const [ generating, setGenerating ] = useState( false );

    const generateInvoice = async () =>
    {
        setGenerating( true );
        try
        {
            const res = await fetch( `/api/admin/orders/${ order._id }/invoice`, { method: 'POST' } );
            const data = await res.json();
            if ( data.success )
            {
                onInvoiceGenerated();
            } else
            {
                alert( data.error || 'Failed to generate invoice' );
            }
        } catch ( err )
        {
            alert( err instanceof Error ? err.message : 'Failed to generate invoice.' );
        } finally
        {
            setGenerating( false );
        }
    };

    const getA4Html = () =>
    {
        const itemsHtml = ( order.items || [] ).map( i => `
            <tr>
                <td>
                    <strong>${ escapeHtml( i.name || 'Product' ) }</strong><br/>
                    <span style="color:#666; font-size:11px;">Size: ${ escapeHtml( i.size || '—' ) } | Color: ${ escapeHtml( i.color || '—' ) }</span>
                </td>
                <td>${ Number( i.quantity || 1 ) }</td>
                <td>${ money( Number( i.price || 0 ) ) }</td>
                <td style="text-align: right;">${ money( lineTotal( i ) ) }</td>
            </tr>
        ` ).join( '' );

        const subtotal = Number( order.subtotal ?? order.items?.reduce( ( acc, item ) => acc + lineTotal( item ), 0 ) ?? 0 );
        const shipping = Number( order.shippingCost || 0 );
        const discount = Number( order.couponDiscount || 0 );
        const tax = Number( order.tax || 0 );
        const shippingAddress = order.shippingAddress || {};
        const address = [ shippingAddress.address, shippingAddress.city, shippingAddress.state, shippingAddress.postalCode, shippingAddress.country ]
            .filter( Boolean )
            .map( escapeHtml )
            .join( '<br/>' );

        return `
        <html>
        <head>
            <title>Invoice - ${ escapeHtml( order.invoiceNumber || order.orderNumber ) }</title>
            <style>
                @page { size: A4; margin: 0; }
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 16mm; color: #1a1a1a; margin: 0; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
                .logo-section { display: flex; flex-direction: column; }
                .logo { font-size: 32px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
                .brand-details { font-size: 12px; color: #666; line-height: 1.5; }
                .invoice-title { font-size: 24px; font-weight: text-transform: uppercase; letter-spacing: 1px; color: #666; text-align: right; }
                .invoice-meta { margin-top: 10px; font-size: 12px; text-align: right; line-height: 1.5; }
                .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; color: #666; }
                .flex { display: flex; justify-content: space-between; margin-bottom: 40px; }
                .box { width: 45%; }
                .address-text { font-size: 13px; line-height: 1.6; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
                th, td { border-bottom: 1px solid #eee; padding: 15px 10px; text-align: left; }
                th { background: #f9f9f9; text-transform: uppercase; font-size: 11px; color: #666; letter-spacing: 1px; }
                .totals-wrap { display: flex; justify-content: flex-end; }
                .totals { width: 350px; }
                .totals-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; }
                .totals-row.total { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 15px; margin-top: 5px; }
                .footer { margin-top: 80px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-section">
                    <div class="logo">SCOTLAND</div>
                    <div class="brand-details">Order billing document</div>
                </div>
                <div>
                    <div class="invoice-title">Order Invoice / Receipt</div>
                    <div class="invoice-meta">
                        <strong>Invoice No:</strong> ${ escapeHtml( order.invoiceNumber || 'Not generated' ) }<br/>
                        <strong>Order ID:</strong> ${ escapeHtml( order.orderNumber ) }<br/>
                        <strong>Date:</strong> ${ new Date( order.createdAt ).toLocaleDateString( 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' } ) }<br/>
                        <strong>Payment:</strong> ${ escapeHtml( ( order.paymentMethod || 'unknown' ).toUpperCase() ) } (${ escapeHtml( ( order.paymentStatus || 'pending' ).toUpperCase() ) })
                    </div>
                </div>
            </div>

            <div class="flex">
                <div class="box">
                    <div class="section-title">Billed & Shipped To</div>
                    <div class="address-text">
                        <strong>${ escapeHtml( shippingAddress.name || 'Customer' ) }</strong><br/>
                        ${ address }<br/>
                        <strong>Phone:</strong> ${ escapeHtml( shippingAddress.phone || '—' ) }<br/>
                        <strong>Email:</strong> ${ escapeHtml( order.userEmail || shippingAddress.email || '—' ) }
                    </div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 50%">Item Description</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${ itemsHtml }
                </tbody>
            </table>

            <div class="totals-wrap">
                <div class="totals">
                    <div class="totals-row">
                        <span>Subtotal</span>
                        <span>${ money( subtotal ) }</span>
                    </div>
                    ${ discount > 0 ? `<div class="totals-row"><span>Discount</span><span>−${ money( discount ) }</span></div>` : '' }
                    <div class="totals-row">
                        <span>Shipping</span>
                        <span>${ money( shipping ) }</span>
                    </div>
                    ${ tax > 0 ? `<div class="totals-row"><span>Tax recorded</span><span>${ money( tax ) }</span></div>` : '' }
                    <div class="totals-row total">
                        <span>Final Total</span>
                        <span>${ money( Number( order.finalAmount || 0 ) ) }</span>
                    </div>
                </div>
            </div>

            <div class="footer">
                Thank you for shopping with SCOTLAND.<br/>
                Seller tax details are not configured in this document. Do not treat it as a statutory tax invoice.
            </div>
        </body>
        </html>
        `;
    };

    const getThermalHtml = () =>
    {
        const itemsHtml = ( order.items || [] ).map( i => `
        <tr class="item-row">
            <td>
                ${ escapeHtml( ( i.name || 'Product' ).substring( 0, 15 ) ) }<br/>
                <span style="font-size:10px;">Sz:${ escapeHtml( i.size || '—' ) } Col:${ escapeHtml( i.color || '—' ) }</span>
            </td>
            <td>${ Number( i.quantity || 1 ) }</td>
            <td class="right">${ money( lineTotal( i ) ) }</td>
        </tr>
        ` ).join( '' );

        const subtotal = Number( order.subtotal ?? order.items?.reduce( ( acc, item ) => acc + lineTotal( item ), 0 ) ?? 0 );
        const shipping = Number( order.shippingCost || 0 );
        const discount = Number( order.couponDiscount || 0 );
        const tax = Number( order.tax || 0 );

        return `
        <html>
        <head>
            <title>Receipt - ${ escapeHtml( order.orderNumber ) }</title>
            <style>
                @page { margin: 0; }
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 78mm; 
                    margin: 0 auto; 
                    padding: 5mm; 
                    color: #000;
                    font-size: 12px;
                    line-height: 1.2;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
                .logo { font-size: 20px; font-weight: 800; letter-spacing: 1px; margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
                th, td { text-align: left; vertical-align: top; }
                th { border-bottom: 1px dashed #000; padding-bottom: 3px; }
                .right { text-align: right; }
                .item-row td { padding-top: 5px; }
            </style>
        </head>
        <body>
            <div class="center">
                <div class="logo">SCOTLAND</div>
                Order invoice / receipt<br/>
                --------------------------------
            </div>
            
            <div class="flex-row">
                Date: ${ new Date( order.createdAt ).toLocaleString() }<br/>
                Inv No: ${ escapeHtml( order.invoiceNumber || 'N/A' ) }<br/>
                Order ID: ${ escapeHtml( order.orderNumber ) }<br/>
                Pay: ${ escapeHtml( ( order.paymentMethod || 'unknown' ).toUpperCase() ) } (${ escapeHtml( order.paymentStatus || 'pending' ) })
            </div>
            
            <div class="divider"></div>
            
            <div class="customer">
                To: ${ escapeHtml( order.shippingAddress?.name || 'Customer' ) }<br/>
                Ph: ${ escapeHtml( order.shippingAddress?.phone || '—' ) }
            </div>
            
            <div class="divider"></div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 50%">Item</th>
                        <th>Qty</th>
                        <th class="right">Amt</th>
                    </tr>
                </thead>
                <tbody>
                    ${ itemsHtml }
                </tbody>
            </table>
            
            <div class="divider"></div>
            
            <table style="margin: 5px 0;">
                <tr>
                    <td>Subtotal</td>
                    <td class="right">${ money( subtotal ) }</td>
                </tr>
                ${ discount > 0 ? `<tr><td>Discount</td><td class="right">−${ money( discount ) }</td></tr>` : '' }
                <tr>
                    <td>Shipping</td>
                    <td class="right">${ money( shipping ) }</td>
                </tr>
                ${ tax > 0 ? `<tr><td>Tax recorded</td><td class="right">${ money( tax ) }</td></tr>` : '' }
                <tr>
                    <td class="bold">TOTAL</td>
                    <td class="right bold">${ money( Number( order.finalAmount || 0 ) ) }</td>
                </tr>
            </table>
            
            <div class="divider"></div>
            
            <div class="center" style="margin-top: 10px;">
                Thank you for shopping!<br/>
                Visit again.<br/>
                Seller tax details are not configured; not a statutory tax invoice.
            </div>
        </body>
        </html>
        `;
    };

    const printDocument = ( html: string ) =>
    {
        const printWindow = window.open( '', '', 'width=800,height=800' );
        if ( !printWindow ) return alert( "Please allow popups to print." );
        printWindow.document.write( html );
        printWindow.document.close();

        setTimeout( () =>
        {
            printWindow.print();
        }, 800 );
    };

    return (
        <div className="bg-white p-5 border border-stone mt-2 rounded flex flex-col gap-4">
            <h3 className="font-semibold text-lg text-navy border-b border-stone pb-2">Billing & Invoicing</h3>

            <div className="flex flex-wrap items-center gap-3">
                { !order.invoiceNumber ? (
                    <button
                        onClick={ generateInvoice }
                        disabled={ generating }
                        className="bg-navy text-white px-5 py-2 text-xs uppercase tracking-widest font-semibold hover:bg-navy/90 disabled:opacity-50"
                    >
                        { generating ? 'Generating...' : '➕ Generate Invoice' }
                    </button>
                ) : (
                    <div className="bg-green-100 text-green-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded border border-green-200">
                        Invoice: { order.invoiceNumber }
                    </div>
                ) }

                <button
                    onClick={ () => printDocument( getA4Html() ) }
                    className="border border-navy text-navy px-5 py-2 text-xs uppercase tracking-widest font-semibold hover:bg-stone-100"
                >
                    📄 Preview / Print A4 Invoice
                </button>

                <button
                    onClick={ () => printDocument( getThermalHtml() ) }
                    className="border border-navy text-navy px-5 py-2 text-xs uppercase tracking-widest font-semibold hover:bg-stone-100"
                >
                    🧾 Preview / Print Thermal Receipt
                </button>
            </div>

            <p className="text-[10px] text-zinc-500 max-w-xl">
                * <strong>PDF Download</strong>: Click "Print A4 Invoice" and select "Save as PDF" as the destination in the print dialog.<br />
                * <strong>Thermal POS Integration</strong>: The thermal receipt format is dynamically generated for standard 80mm ESC/POS continuous roll printers. Set paper size to 80mm when printing.
            </p>
        </div>
    );
}
