'use client';

import { useEffect, useState } from 'react';

const money = ( n: number ) =>
    new Intl.NumberFormat( 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 } ).format( n );

export default function AdminCustomersPage ()
{
    const [ customers, setCustomers ] = useState<any[]>( [] );
    const [ loading, setLoading ] = useState( true );
    const [ search, setSearch ] = useState( '' );

    useEffect( () =>
    {
        fetch( '/api/admin/customers' )
            .then( r => r.json() )
            .then( d => setCustomers( d.data || [] ) )
            .finally( () => setLoading( false ) );
    }, [] );

    const filtered = customers.filter( c =>
        !search ||
        c.name?.toLowerCase().includes( search.toLowerCase() ) ||
        c.email?.toLowerCase().includes( search.toLowerCase() )
    );

    return (
        <main className="shell py-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="eyebrow">Admin</p>
                    <h1 className="display mt-2 text-4xl">Customers</h1>
                    { !loading && <p className="mt-1 text-sm text-zinc-400">{ filtered.length } customer{ filtered.length !== 1 ? 's' : '' }</p> }
                </div>
                <input
                    className="input w-64 rounded-lg"
                    placeholder="Search name / email…"
                    value={ search }
                    onChange={ e => setSearch( e.target.value ) }
                />
            </div>

            <div className="mt-8 overflow-x-auto rounded-xl border border-stone/30 bg-white">
                { loading ? (
                    <div className="p-10 text-center text-zinc-400 animate-pulse">Loading customers…</div>
                ) : !filtered.length ? (
                    <div className="p-10 text-center text-zinc-400">No customers found.</div>
                ) : (
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="border-b border-stone bg-stone/20">
                            <tr>
                                { [ 'Customer', 'Email', 'Phone', 'Orders', 'Total Spent', 'Joined', 'Last Order' ].map( h => (
                                    <th key={ h } className="p-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{ h }</th>
                                ) ) }
                            </tr>
                        </thead>
                        <tbody>
                            { filtered.map( c => (
                                <tr key={ c.userId } className="border-b border-stone/30 hover:bg-stone/10 transition">
                                    <td className="p-4 font-semibold text-navy">{ c.name || '—' }</td>
                                    <td className="p-4 text-zinc-600">{ c.email }</td>
                                    <td className="p-4 text-zinc-600">{ c.phone || '—' }</td>
                                    <td className="p-4">
                                        <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-bold text-navy">
                                            { c.orderCount }
                                        </span>
                                    </td>
                                    <td className="p-4 font-semibold text-gold">{ money( c.totalSpent ) }</td>
                                    <td className="p-4 text-xs text-zinc-500">
                                        { c.firstOrderAt ? new Date( c.firstOrderAt ).toLocaleDateString( 'en-IN' ) : '—' }
                                    </td>
                                    <td className="p-4 text-xs text-zinc-500">
                                        { c.lastOrderAt ? new Date( c.lastOrderAt ).toLocaleDateString( 'en-IN' ) : '—' }
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
