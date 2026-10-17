'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type CategoryRecord = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    seo_title: string | null;
    seo_description: string | null;
    is_active: boolean;
};

function emptyCategory (): Omit<CategoryRecord, 'id'> & { id?: string }
{
    return { name: '', slug: '', description: '', seo_title: '', seo_description: '', is_active: true };
}

function slugify ( value: string ): string
{
    return value.trim().toLowerCase().normalize( 'NFKD' )
        .replace( /[\u0300-\u036f]/g, '' )
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /(^-|-$)/g, '' );
}

export default function AdminCategories ()
{
    const [ categories, setCategories ] = useState<CategoryRecord[]>( [] );
    const [ draft, setDraft ] = useState( emptyCategory );
    const [ pending, setPending ] = useState( '' );
    const [ error, setError ] = useState( '' );
    const [ message, setMessage ] = useState( '' );

    const loadCategories = useCallback( async () =>
    {
        const response = await fetch( '/api/admin/categories', { cache: 'no-store' } );
        const result = await response.json();
        if ( !response.ok ) throw new Error( result.error || 'Could not load categories.' );
        setCategories( result.data );
    }, [] );

    useEffect( () =>
    {
        void loadCategories().catch( cause => setError( cause instanceof Error ? cause.message : 'Could not load categories.' ) );
    }, [ loadCategories ] );

    async function saveCategory ( event: FormEvent<HTMLFormElement>, id?: string )
    {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData( form );
        const category = {
            ...( id ? { id } : {} ),
            name: String( formData.get( 'name' ) || '' ),
            slug: String( formData.get( 'slug' ) || '' ),
            description: String( formData.get( 'description' ) || '' ),
            seo_title: String( formData.get( 'seo_title' ) || '' ),
            seo_description: String( formData.get( 'seo_description' ) || '' ),
            is_active: formData.get( 'is_active' ) === 'on',
        };
        setPending( id || 'new' );
        setError( '' );
        setMessage( '' );

        try
        {
            const response = await fetch( '/api/admin/categories', {
                method: id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( category ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not save category.' );
            setMessage( `${ result.data.name } saved.` );
            if ( !id ) setDraft( emptyCategory() );
            await loadCategories();
        } catch ( cause )
        {
            setError( cause instanceof Error ? cause.message : 'Could not save category.' );
        } finally
        {
            setPending( '' );
        }
    }

    return (
        <main className="shell py-10 sm:py-12">
            <p className="eyebrow">Catalog · Search appearance</p>
            <h1 className="display mt-2 text-4xl sm:text-5xl">Category SEO</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Write useful, distinct category copy. Collections with fewer than three published products are automatically marked noindex until they have enough inventory.
            </p>
            { error && <p className="mt-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{ error }</p> }
            { message && <p className="mt-5 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{ message }</p> }

            <form onSubmit={ event => void saveCategory( event ) } className="mt-8 space-y-4 border border-stone bg-white p-5 sm:p-6">
                <h2 className="display text-2xl">Add a collection</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-xs text-zinc-600">Category name<input className="input mt-1" name="name" required value={ draft.name } onChange={ event => setDraft( current => ( { ...current, name: event.target.value, slug: slugify( event.target.value ) } ) ) } /></label>
                    <label className="text-xs text-zinc-600">URL slug<input className="input mt-1" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={ draft.slug } onChange={ event => setDraft( current => ( { ...current, slug: event.target.value } ) ) } /></label>
                    <label className="text-xs text-zinc-600">SEO title<input className="input mt-1" name="seo_title" maxLength={ 70 } value={ draft.seo_title || '' } onChange={ event => setDraft( current => ( { ...current, seo_title: event.target.value } ) ) } /></label>
                    <label className="text-xs text-zinc-600">SEO description<textarea className="input mt-1 min-h-20" name="seo_description" maxLength={ 160 } value={ draft.seo_description || '' } onChange={ event => setDraft( current => ( { ...current, seo_description: event.target.value } ) ) } /></label>
                    <label className="text-xs text-zinc-600 md:col-span-2">Collection content<textarea className="input mt-1 min-h-24" name="description" maxLength={ 3000 } value={ draft.description || '' } onChange={ event => setDraft( current => ( { ...current, description: event.target.value } ) ) } /></label>
                </div>
                <button className="button" disabled={ pending === 'new' }>{ pending === 'new' ? 'Saving…' : 'Create category' }</button>
            </form>

            <div className="mt-8 space-y-5">
                { categories.map( category => (
                    <form key={ category.id } onSubmit={ event => void saveCategory( event, category.id ) } className="space-y-4 border border-stone bg-white p-5 sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="display text-xl">{ category.name }</h2>
                            <a className="text-xs underline" href={ `/category/${ category.slug }` } target="_blank" rel="noreferrer">Preview collection</a>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="text-xs text-zinc-600">Category name<input className="input mt-1" name="name" required defaultValue={ category.name } /></label>
                            <label className="text-xs text-zinc-600">URL slug<input className="input mt-1" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={ category.slug } /></label>
                            <label className="text-xs text-zinc-600">SEO title<input className="input mt-1" name="seo_title" maxLength={ 70 } defaultValue={ category.seo_title || '' } /></label>
                            <label className="text-xs text-zinc-600">SEO description<textarea className="input mt-1 min-h-20" name="seo_description" maxLength={ 160 } defaultValue={ category.seo_description || '' } /></label>
                            <label className="text-xs text-zinc-600 md:col-span-2">Collection content<textarea className="input mt-1 min-h-24" name="description" maxLength={ 3000 } defaultValue={ category.description || '' } /></label>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" name="is_active" defaultChecked={ category.is_active } /> Visible to shoppers</label>
                            <button className="button" disabled={ pending === category.id }>{ pending === category.id ? 'Saving…' : 'Save category SEO' }</button>
                        </div>
                    </form>
                ) ) }
            </div>
        </main>
    );
}
