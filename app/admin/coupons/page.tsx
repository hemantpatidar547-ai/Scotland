'use client';

import { useEffect, useState } from 'react';

export default function AdminCouponsPage ()
{
    const [ coupons, setCoupons ] = useState<any[]>( [] );
    const [ loading, setLoading ] = useState( true );
    const [ showForm, setShowForm ] = useState( false );
    const [ saving, setSaving ] = useState( false );
    const [ toast, setToast ] = useState( '' );

    const [ form, setForm ] = useState( {
        code: '', discountType: 'percentage', discountValue: '',
        minimumOrderAmount: '', maximumDiscount: '', usageLimit: '', expiresAt: '',
    } );

    const loadCoupons = () =>
    {
        setLoading( true );
        fetch( '/api/admin/coupons' )
            .then( r => r.json() )
            .then( d => setCoupons( d.data || [] ) )
            .finally( () => setLoading( false ) );
    };

    useEffect( () => { loadCoupons(); }, [] );

    function showMsg ( msg: string ) { setToast( msg ); setTimeout( () => setToast( '' ), 3000 ); }

    async function createCoupon ( e: React.FormEvent )
    {
        e.preventDefault();
        setSaving( true );
        const res = await fetch( '/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( form ),
        } );
        const data = await res.json();
        setSaving( false );
        if ( data.success ) { showMsg( 'Coupon created!' ); setShowForm( false ); setForm( { code: '', discountType: 'percentage', discountValue: '', minimumOrderAmount: '', maximumDiscount: '', usageLimit: '', expiresAt: '' } ); loadCoupons(); }
        else showMsg( data.error || 'Failed to create' );
    }

    async function toggleActive ( id: string, isActive: boolean )
    {
        await fetch( '/api/admin/coupons', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { id, isActive } ),
        } );
        loadCoupons();
    }

    async function deleteCoupon ( id: string )
    {
        if ( !confirm( 'Delete this coupon?' ) ) return;
        await fetch( '/api/admin/coupons', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { id } ),
        } );
        loadCoupons();
    }

    const inp = 'input rounded-lg w-full';

    return (
        <main className="shell py-12">
            { toast && (
                <div className="fixed top-6 right-6 z-50 rounded-xl bg-navy px-5 py-3 text-sm text-white shadow-xl animate-pulse">
                    { toast }
                </div>
            ) }

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Admin</p>
                    <h1 className="display mt-2 text-4xl">Coupons</h1>
                </div>
                <button className="button" onClick={ () => setShowForm( !showForm ) }>{ showForm ? '× Cancel' : '+ New Coupon' }</button>
            </div>

            { /* Create form */ }
            { showForm && (
                <form onSubmit={ createCoupon } className="mt-8 rounded-xl border border-stone/30 bg-white p-6 space-y-5">
                    <h2 className="font-semibold text-lg">Create coupon</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label className="eyebrow block mb-1">Code *</label>
                            <input className={ inp } required placeholder="e.g. SAVE20" value={ form.code } onChange={ e => setForm( f => ( { ...f, code: e.target.value.toUpperCase() } ) ) } />
                        </div>
                        <div>
                            <label className="eyebrow block mb-1">Discount type *</label>
                            <select className={ inp } value={ form.discountType } onChange={ e => setForm( f => ( { ...f, discountType: e.target.value } ) ) }>
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed amount (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="eyebrow block mb-1">Discount value *</label>
                            <input className={ inp } required type="number" min="1" placeholder={ form.discountType === 'percentage' ? '20 (%)' : '200 (₹)' } value={ form.discountValue } onChange={ e => setForm( f => ( { ...f, discountValue: e.target.value } ) ) } />
                        </div>
                        <div>
                            <label className="eyebrow block mb-1">Min. order (₹)</label>
                            <input className={ inp } type="number" min="0" placeholder="0" value={ form.minimumOrderAmount } onChange={ e => setForm( f => ( { ...f, minimumOrderAmount: e.target.value } ) ) } />
                        </div>
                        { form.discountType === 'percentage' && (
                            <div>
                                <label className="eyebrow block mb-1">Max discount (₹)</label>
                                <input className={ inp } type="number" min="0" placeholder="500" value={ form.maximumDiscount } onChange={ e => setForm( f => ( { ...f, maximumDiscount: e.target.value } ) ) } />
                            </div>
                        ) }
                        <div>
                            <label className="eyebrow block mb-1">Usage limit</label>
                            <input className={ inp } type="number" min="1" placeholder="Unlimited" value={ form.usageLimit } onChange={ e => setForm( f => ( { ...f, usageLimit: e.target.value } ) ) } />
                        </div>
                        <div>
                            <label className="eyebrow block mb-1">Expires on</label>
                            <input className={ inp } type="date" value={ form.expiresAt } onChange={ e => setForm( f => ( { ...f, expiresAt: e.target.value } ) ) } />
                        </div>
                    </div>
                    <button className="button" type="submit" disabled={ saving }>{ saving ? 'Saving…' : 'Create coupon' }</button>
                </form>
            ) }

            { /* Coupons table */ }
            <div className="mt-8 overflow-x-auto rounded-xl border border-stone/30 bg-white">
                { loading ? (
                    <div className="p-10 text-center text-zinc-400 animate-pulse">Loading coupons…</div>
                ) : !coupons.length ? (
                    <div className="p-10 text-center text-zinc-400">No coupons yet. Create your first one!</div>
                ) : (
                    <table className="w-full min-w-[780px] text-left text-sm">
                        <thead className="border-b border-stone bg-stone/20">
                            <tr>
                                { [ 'Code', 'Type', 'Value', 'Min Order', 'Used / Limit', 'Expires', 'Status', 'Actions' ].map( h => (
                                    <th key={ h } className="p-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{ h }</th>
                                ) ) }
                            </tr>
                        </thead>
                        <tbody>
                            { coupons.map( c => (
                                <tr key={ c._id } className="border-b border-stone/30 hover:bg-stone/10 transition">
                                    <td className="p-4 font-mono font-bold tracking-widest text-navy">{ c.code }</td>
                                    <td className="p-4 capitalize">{ c.discountType }</td>
                                    <td className="p-4 font-semibold text-gold">{ c.discountType === 'percentage' ? `${ c.discountValue }%` : `₹${ c.discountValue }` }</td>
                                    <td className="p-4">{ c.minimumOrderAmount ? `₹${ c.minimumOrderAmount }` : '—' }</td>
                                    <td className="p-4">{ c.usedCount } / { c.usageLimit ?? '∞' }</td>
                                    <td className="p-4 text-xs text-zinc-500">{ c.expiresAt ? new Date( c.expiresAt ).toLocaleDateString( 'en-IN' ) : 'Never' }</td>
                                    <td className="p-4">
                                        <button
                                            onClick={ () => toggleActive( c._id, !c.isActive ) }
                                            className={ `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${ c.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200' }` }
                                        >
                                            { c.isActive ? 'Active' : 'Inactive' }
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={ () => deleteCoupon( c._id ) } className="text-xs text-red-500 underline hover:text-red-700">Delete</button>
                                    </td>
                                </tr>
                            ) ) }
                        </tbody>
                    </table>
                ) }
            </div>
        </main>
    );
}
