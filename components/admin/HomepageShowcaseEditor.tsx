'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_HOMEPAGE_SHOWCASE, type HomepageShowcase } from '@/types/homepage-showcase';

export function HomepageShowcaseEditor ()
{
    const router = useRouter();
    const [ content, setContent ] = useState<HomepageShowcase>( DEFAULT_HOMEPAGE_SHOWCASE );
    const [ loading, setLoading ] = useState( true );
    const [ saving, setSaving ] = useState( false );
    const [ uploading, setUploading ] = useState<number[]>( [] );
    const [ uploadingFeaturedImage, setUploadingFeaturedImage ] = useState( false );
    const [ error, setError ] = useState( '' );
    const [ notice, setNotice ] = useState( '' );

    useEffect( () =>
    {
        fetch( '/api/admin/homepage-showcase', { cache: 'no-store' } )
            .then( async response =>
            {
                const result = await response.json();
                if ( !response.ok ) throw new Error( result.error || 'Could not load homepage content.' );
                setContent( result );
            } )
            .catch( issue => setError( issue instanceof Error ? issue.message : 'Could not load homepage content.' ) )
            .finally( () => setLoading( false ) );
    }, [] );

    const update = ( key: keyof HomepageShowcase, value: HomepageShowcase[keyof HomepageShowcase] ) =>
    {
        setError( '' );
        setContent( previous => ( { ...previous, [ key ]: value } ) );
    };

    const updateCard = ( index: number, key: 'image' | 'title' | 'detail', value: string ) =>
    {
        setError( '' );
        setContent( previous => ( {
            ...previous,
            cards: previous.cards.map( ( card, cardIndex ) => cardIndex === index ? { ...card, [ key ]: value } : card ),
        } ) );
    };

    const uploadImage = async ( index: number, event: ChangeEvent<HTMLInputElement> ) =>
    {
        const input = event.currentTarget;
        const file = input.files?.[ 0 ];
        if ( !file ) return;

        setError( '' );
        setUploading( previous => [ ...previous, index ] );
        const formData = new FormData();
        formData.set( 'file', file );
        try
        {
            const response = await fetch( '/api/admin/product-images', { method: 'POST', body: formData } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Image upload failed.' );
            updateCard( index, 'image', result.url );
        } catch ( issue )
        {
            setError( issue instanceof Error ? issue.message : 'Image upload failed.' );
        } finally
        {
            setUploading( previous => previous.filter( activeIndex => activeIndex !== index ) );
            input.value = '';
        }
    };

    const uploadFeaturedImage = async ( event: ChangeEvent<HTMLInputElement> ) =>
    {
        const input = event.currentTarget;
        const file = input.files?.[ 0 ];
        if ( !file ) return;

        setError( '' );
        setUploadingFeaturedImage( true );
        const formData = new FormData();
        formData.set( 'file', file );
        try
        {
            const response = await fetch( '/api/admin/product-images', { method: 'POST', body: formData } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Image upload failed.' );
            update( 'featuredImage', result.url );
        } catch ( issue )
        {
            setError( issue instanceof Error ? issue.message : 'Image upload failed.' );
        } finally
        {
            setUploadingFeaturedImage( false );
            input.value = '';
        }
    };

    const save = async ( event: FormEvent<HTMLFormElement> ) =>
    {
        event.preventDefault();
        setError( '' );
        setNotice( '' );
        setSaving( true );
        try
        {
            const response = await fetch( '/api/admin/homepage-showcase', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( content ),
            } );
            const result = await response.json();
            if ( !response.ok ) throw new Error( result.error || 'Could not save homepage content.' );
            setContent( result );
            setNotice( 'Homepage showcase saved.' );
            router.refresh();
        } catch ( issue )
        {
            setError( issue instanceof Error ? issue.message : 'Could not save homepage content.' );
        } finally
        {
            setSaving( false );
        }
    };

    if ( loading ) return <p className="mt-8 text-sm text-zinc-500">Loading homepage content…</p>;

    return <form className="mt-8 space-y-6" onSubmit={ save }>
        { error && <p role="alert" className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{ error }</p> }
        { notice && <p role="status" className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{ notice }</p> }

        <section className="space-y-4 border border-stone bg-white p-5 sm:p-6">
            <div className="border-b border-stone pb-4">
                <h2 className="display text-2xl">Featured collection image</h2>
                <p className="mt-1 text-sm text-zinc-500">This controls the large image beside “The Edinburgh weekender” on the homepage.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="relative aspect-[1.4] overflow-hidden bg-stone">
                    <img src={ content.featuredImage } alt="Featured collection preview" className="h-full w-full object-cover" />
                </div>
                <div className="space-y-4">
                    <label className="block text-sm font-medium">Image path or public URL
                        <input className="mt-1 w-full border border-stone px-3 py-2" required value={ content.featuredImage } onChange={ event => update( 'featuredImage', event.target.value ) } />
                    </label>
                    <label className="block text-sm font-medium">Upload replacement image
                        <input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" disabled={ uploadingFeaturedImage } onChange={ event => void uploadFeaturedImage( event ) } />
                        <span className="mt-1 block text-xs text-zinc-500">{ uploadingFeaturedImage ? 'Uploading…' : 'JPEG, PNG, WebP, AVIF, or GIF; maximum 4 MB.' }</span>
                    </label>
                </div>
            </div>
        </section>

        <section className="space-y-4 border border-stone bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone pb-4">
                <div><h2 className="display text-2xl">Homepage collection section</h2><p className="mt-1 text-sm text-zinc-500">Manage the heading, launch message, visibility, and every collection card shown on the storefront.</p></div>
                <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={ content.enabled } onChange={ event => update( 'enabled', event.target.checked ) } />
                    Show on homepage
                </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Small label
                    <input className="mt-1 w-full border border-stone px-3 py-2" maxLength={ 80 } value={ content.eyebrow } onChange={ event => update( 'eyebrow', event.target.value ) } />
                </label>
                <label className="text-sm font-medium">Heading
                    <input className="mt-1 w-full border border-stone px-3 py-2" maxLength={ 120 } required value={ content.title } onChange={ event => update( 'title', event.target.value ) } />
                </label>
                <label className="text-sm font-medium sm:col-span-2">Description
                    <textarea className="mt-1 min-h-24 w-full border border-stone px-3 py-2" maxLength={ 500 } required value={ content.description } onChange={ event => update( 'description', event.target.value ) } />
                </label>
                <label className="text-sm font-medium sm:col-span-2">Badge (leave empty to hide)
                    <input className="mt-1 w-full border border-stone px-3 py-2" maxLength={ 80 } value={ content.badge } onChange={ event => update( 'badge', event.target.value ) } />
                </label>
            </div>
        </section>

        <section className="space-y-4 border border-stone bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone pb-4">
                <div><h2 className="display text-2xl">Showcase cards</h2><p className="mt-1 text-sm text-zinc-500">Add or remove images and update each card’s title and description.</p></div>
                <button type="button" disabled={ content.cards.length >= 8 || uploading.length > 0 } className="button-outline text-sm disabled:opacity-50" onClick={ () => update( 'cards', [ ...content.cards, { image: '/images/new-arrivals/MEN FASHION.jpeg', title: 'New style', detail: 'Add a short description for this style.' } ] ) }>Add card</button>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
                { content.cards.map( ( card, index ) => <article key={ index } className="space-y-3 border border-stone p-4">
                    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Card { index + 1 }</h3><button type="button" disabled={ content.cards.length <= 1 || uploading.includes( index ) } className="text-sm text-rose-700 underline disabled:opacity-40" onClick={ () => update( 'cards', content.cards.filter( ( _, cardIndex ) => cardIndex !== index ) ) }>Remove</button></div>
                    <div className="relative aspect-[1.7] overflow-hidden bg-stone">
                        {/* Use a regular image so administrators can preview both local and public storage URLs. */}
                        <img src={ card.image } alt={ card.title } className="h-full w-full object-cover" />
                    </div>
                    <label className="block text-sm font-medium">Image path or public URL
                        <input className="mt-1 w-full border border-stone px-3 py-2" required value={ card.image } onChange={ event => updateCard( index, 'image', event.target.value ) } />
                    </label>
                    <label className="block text-sm font-medium">Upload replacement image
                        <input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" disabled={ uploading.includes( index ) } onChange={ event => void uploadImage( index, event ) } />
                        <span className="mt-1 block text-xs text-zinc-500">{ uploading.includes( index ) ? 'Uploading…' : 'JPEG, PNG, WebP, AVIF, or GIF; maximum 4 MB.' }</span>
                    </label>
                    <label className="block text-sm font-medium">Card title
                        <input className="mt-1 w-full border border-stone px-3 py-2" maxLength={ 120 } required value={ card.title } onChange={ event => updateCard( index, 'title', event.target.value ) } />
                    </label>
                    <label className="block text-sm font-medium">Card description
                        <textarea className="mt-1 min-h-20 w-full border border-stone px-3 py-2" maxLength={ 300 } required value={ card.detail } onChange={ event => updateCard( index, 'detail', event.target.value ) } />
                    </label>
                </article> ) }
            </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
            <button className="button disabled:opacity-50" type="submit" disabled={ saving || uploading.length > 0 || uploadingFeaturedImage }>
                { saving ? 'Saving…' : uploading.length || uploadingFeaturedImage ? 'Wait for uploads…' : 'Save homepage content' }
            </button>
            <span className="text-sm text-zinc-600">After uploading or changing an image, click Save homepage content to publish it.</span>
            <a className="text-sm text-navy underline" href="/" target="_blank" rel="noreferrer">Preview live homepage</a>
        </div>
    </form>;
}
