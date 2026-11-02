'use client';

import { useCallback, useEffect, useState } from 'react';

type ContactMessage = {
    id: string;
    name: string;
    phone: string;
    message: string;
    created_at: string;
};

export default function AdminContactMessagesPage ()
{
    const [ messages, setMessages ] = useState<ContactMessage[]>( [] );
    const [ page, setPage ] = useState( 1 );
    const [ totalPages, setTotalPages ] = useState( 1 );
    const [ total, setTotal ] = useState( 0 );
    const [ loading, setLoading ] = useState( true );
    const [ error, setError ] = useState( '' );

    const loadMessages = useCallback( async ( requestedPage: number ) =>
    {
        setLoading( true );
        setError( '' );
        try
        {
            const response = await fetch( `/api/admin/contact-messages?page=${ requestedPage }`, { cache: 'no-store' } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not load contact messages.' );
            setMessages( result.data || [] );
            setPage( result.pagination?.page || requestedPage );
            setTotalPages( Math.max( 1, result.pagination?.totalPages || 1 ) );
            setTotal( result.pagination?.total || 0 );
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not load contact messages.' );
        } finally
        {
            setLoading( false );
        }
    }, [] );

    useEffect( () =>
    {
        void loadMessages( page );
    }, [ loadMessages, page ] );

    return <main className="shell py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
                <p className="eyebrow">Admin</p>
                <h1 className="display mt-2 text-4xl">Contact messages</h1>
                <p className="mt-2 text-sm text-zinc-600">{ total } message{ total === 1 ? '' : 's' } received</p>
            </div>
            <button type="button" className="button-outline" disabled={ loading } onClick={ () => void loadMessages( page ) }>Refresh</button>
        </div>

        <section className="mt-7 overflow-x-auto rounded-xl border border-stone/30 bg-white">
            { loading ? <p className="p-10 text-center text-zinc-500">Loading messages…</p> :
                error ? <p className="p-10 text-center text-rose-700" role="alert">{ error }</p> :
                    !messages.length ? <p className="p-10 text-center text-zinc-500">No contact messages yet.</p> :
                        <table className="w-full min-w-[700px] text-left text-sm">
                            <thead className="border-b border-stone bg-stone/20">
                                <tr>
                                    { [ 'Received', 'Name', 'Mobile number', 'Message' ].map( heading => <th key={ heading } className="p-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{ heading }</th> ) }
                                </tr>
                            </thead>
                            <tbody>
                                { messages.map( item => <tr key={ item.id } className="border-b border-stone/30 align-top last:border-0">
                                    <td className="whitespace-nowrap p-4 text-xs text-zinc-500">{ new Date( item.created_at ).toLocaleString( 'en-IN' ) }</td>
                                    <td className="p-4 font-medium text-navy">{ item.name }</td>
                                    <td className="whitespace-nowrap p-4"><a className="underline" href={ `tel:${ item.phone }` }>{ item.phone }</a></td>
                                    <td className="max-w-xl whitespace-pre-wrap break-words p-4 text-zinc-700">{ item.message }</td>
                                </tr> ) }
                            </tbody>
                        </table> }
        </section>

        <div className="mt-4 flex items-center justify-between">
            <button className="button-outline" type="button" disabled={ loading || page <= 1 } onClick={ () => setPage( current => current - 1 ) }>Previous</button>
            <p className="text-sm text-zinc-500">Page { page } of { totalPages }</p>
            <button className="button-outline" type="button" disabled={ loading || page >= totalPages } onClick={ () => setPage( current => current + 1 ) }>Next</button>
        </div>
    </main>;
}
