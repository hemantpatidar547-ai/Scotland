'use client';

import { FormEvent, useEffect, useState } from 'react';

type CustomerProfile = { full_name: string; email: string; phone: string };
type CustomerAddress = {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    address_line: string;
    city: string;
    postal_code: string;
    country: string;
    is_default: boolean;
};

async function readResponse ( response: Response )
{
    const result = await response.json();
    if ( !response.ok ) throw new Error( result.error || 'Request failed.' );
    return result.data;
}

export function AccountProfileForm ()
{
    const [ profile, setProfile ] = useState<CustomerProfile>( { full_name: '', email: '', phone: '' } );
    const [ message, setMessage ] = useState( '' );
    const [ loading, setLoading ] = useState( true );
    const [ saving, setSaving ] = useState( false );

    useEffect( () =>
    {
        fetch( '/api/account/profile', { cache: 'no-store' } )
            .then( readResponse )
            .then( setProfile )
            .catch( error => setMessage( error.message ) )
            .finally( () => setLoading( false ) );
    }, [] );

    async function save ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        setSaving( true );
        setMessage( '' );
        try
        {
            const result = await readResponse( await fetch( '/api/account/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( profile ),
            } ) );
            setProfile( result );
            setMessage( 'Your profile has been saved.' );
        } catch ( error )
        {
            setMessage( error instanceof Error ? error.message : 'Could not save your profile.' );
        } finally
        {
            setSaving( false );
        }
    }

    if ( loading ) return <p className="mt-6 text-sm text-zinc-500">Loading your profile…</p>;

    return (
        <form onSubmit={ save } className="mt-6 max-w-xl space-y-4 rounded-xl border border-stone bg-white p-6">
            <label className="block text-sm font-medium">Full name
                <input className="input mt-2" maxLength={ 120 } required value={ profile.full_name || '' } onChange={ event => setProfile( { ...profile, full_name: event.target.value } ) } />
            </label>
            <label className="block text-sm font-medium">Email
                <input className="input mt-2 bg-stone/30" value={ profile.email || '' } readOnly />
            </label>
            <label className="block text-sm font-medium">Mobile number
                <input className="input mt-2" maxLength={ 30 } autoComplete="tel" value={ profile.phone || '' } onChange={ event => setProfile( { ...profile, phone: event.target.value } ) } />
            </label>
            { message && <p className="text-sm text-navy" role="status">{ message }</p> }
            <button className="button" disabled={ saving }>{ saving ? 'Saving…' : 'Save profile' }</button>
        </form>
    );
}

const emptyAddress = {
    label: 'Home',
    recipient_name: '',
    phone: '',
    address_line: '',
    city: '',
    postal_code: '',
    country: 'India',
    is_default: false,
};

export function AccountAddresses ()
{
    const [ addresses, setAddresses ] = useState<CustomerAddress[]>( [] );
    const [ address, setAddress ] = useState( emptyAddress );
    const [ editingId, setEditingId ] = useState<string | null>( null );
    const [ message, setMessage ] = useState( '' );
    const [ loading, setLoading ] = useState( true );

    async function refresh ()
    {
        const result = await readResponse( await fetch( '/api/account/addresses', { cache: 'no-store' } ) );
        setAddresses( result );
    }

    useEffect( () =>
    {
        refresh().catch( error => setMessage( error.message ) ).finally( () => setLoading( false ) );
    }, [] );

    async function addAddress ( event: FormEvent<HTMLFormElement> )
    {
        event.preventDefault();
        setMessage( '' );
        try
        {
            await readResponse( await fetch( '/api/account/addresses', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( editingId ? { id: editingId, address } : address ),
            } ) );
            setAddress( emptyAddress );
            setEditingId( null );
            await refresh();
            setMessage( editingId ? 'Address updated.' : 'Address saved.' );
        } catch ( error )
        {
            setMessage( error instanceof Error ? error.message : 'Could not save this address.' );
        }
    }

    async function removeAddress ( id: string )
    {
        try
        {
            await readResponse( await fetch( `/api/account/addresses?id=${ encodeURIComponent( id ) }`, { method: 'DELETE' } ) );
            await refresh();
        } catch ( error )
        {
            setMessage( error instanceof Error ? error.message : 'Could not remove this address.' );
        }
    }

    function editAddress ( saved: CustomerAddress )
    {
        setAddress( {
            label: saved.label,
            recipient_name: saved.recipient_name,
            phone: saved.phone,
            address_line: saved.address_line,
            city: saved.city,
            postal_code: saved.postal_code,
            country: saved.country,
            is_default: saved.is_default,
        } );
        setEditingId( saved.id );
        setMessage( '' );
    }

    async function setDefaultAddress ( id: string )
    {
        try
        {
            await readResponse( await fetch( '/api/account/addresses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { id, address: { is_default: true } } ),
            } ) );
            await refresh();
        } catch ( error )
        {
            setMessage( error instanceof Error ? error.message : 'Could not update the default address.' );
        }
    }

    return (
        <section className="mt-12">
            <h2 className="display text-3xl">Saved addresses</h2>
            { loading ? <p className="mt-4 text-sm text-zinc-500">Loading saved addresses…</p> : addresses.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    { addresses.map( saved => (
                        <article className="rounded-xl border border-stone bg-white p-5" key={ saved.id }>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{ saved.label } { saved.is_default && <span className="text-xs text-gold">· Default</span> }</p>
                                    <p className="mt-2 text-sm">{ saved.recipient_name } · { saved.phone }</p>
                                    <p className="mt-1 text-sm text-zinc-600">{ saved.address_line }, { saved.city }, { saved.postal_code }, { saved.country }</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <button className="text-xs underline" type="button" onClick={ () => editAddress( saved ) }>Edit</button>
                                    { !saved.is_default && <button className="text-xs underline" type="button" onClick={ () => void setDefaultAddress( saved.id ) }>Set default</button> }
                                    <button className="text-xs text-red-700 underline" type="button" onClick={ () => void removeAddress( saved.id ) }>Remove</button>
                                </div>
                            </div>
                        </article>
                    ) ) }
                </div>
            ) : <p className="mt-4 text-sm text-zinc-600">You have not saved an address yet.</p> }

            <form onSubmit={ addAddress } className="mt-6 grid max-w-3xl gap-3 rounded-xl border border-stone bg-white p-6 sm:grid-cols-2">
                <h3 className="font-semibold sm:col-span-2">{ editingId ? 'Edit address' : 'Add an address' }</h3>
                <input className="input" placeholder="Label (Home, Work)" maxLength={ 40 } value={ address.label } onChange={ event => setAddress( { ...address, label: event.target.value } ) } required />
                <input className="input" placeholder="Recipient name" maxLength={ 120 } value={ address.recipient_name } onChange={ event => setAddress( { ...address, recipient_name: event.target.value } ) } required />
                <input className="input" placeholder="Mobile number" maxLength={ 30 } autoComplete="tel" value={ address.phone } onChange={ event => setAddress( { ...address, phone: event.target.value } ) } required />
                <input className="input" placeholder="Address" maxLength={ 300 } value={ address.address_line } onChange={ event => setAddress( { ...address, address_line: event.target.value } ) } required />
                <input className="input" placeholder="City" maxLength={ 100 } value={ address.city } onChange={ event => setAddress( { ...address, city: event.target.value } ) } required />
                <input className="input" placeholder="Postal code" maxLength={ 20 } value={ address.postal_code } onChange={ event => setAddress( { ...address, postal_code: event.target.value } ) } required />
                <input className="input" placeholder="Country" maxLength={ 80 } value={ address.country } onChange={ event => setAddress( { ...address, country: event.target.value } ) } required />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ address.is_default } onChange={ event => setAddress( { ...address, is_default: event.target.checked } ) } /> Set as default</label>
                { message && <p className="text-sm text-navy sm:col-span-2" role="status">{ message }</p> }
                <button className="button sm:col-span-2">{ editingId ? 'Update address' : 'Save address' }</button>
                { editingId && <button className="button-outline sm:col-span-2" type="button" onClick={ () => { setEditingId( null ); setAddress( emptyAddress ); } }>Cancel editing</button> }
            </form>
        </section>
    );
}
