'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types/product';

const PRESET_CATEGORIES = [ 'Clothing', 'Topwear', 'Bottomwear', 'Footwear', 'Accessories' ];
const PRESET_SUBCATEGORIES = [ 'Shirt', 'Half Shirt', 'Full Shirt', 'Plain Shirt', 'Baggy Shirt', 'T-Shirt', 'Oversized T-Shirt', 'Polo T-Shirt', 'Lower', 'Joggers', 'Jeans', 'Sweatshirt', 'Hoodie', 'Jacket', 'Blazer', 'Shorts', 'Cargo' ];
const SIZES_LIST = [ 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40' ];
const COLORS_LIST = [ 'Black', 'White', 'Navy', 'Grey', 'Red', 'Blue', 'Green', 'Yellow', 'Brown', 'Olive', 'Maroon', 'Pink', 'Orange', 'Purple', 'Beige' ];
const GST_OPTIONS = [ '0%', '5%', '12%', '18%', '28%' ];

function SectionCard ( { title, children }: { title: string; children: React.ReactNode } )
{
    return (
        <div className="bg-white rounded border border-stone p-6 space-y-4">
            <h3 className="font-semibold text-sm text-navy border-b border-stone pb-2 uppercase tracking-wider">{ title }</h3>
            { children }
        </div>
    );
}

function Field ( { label, children, full }: { label: string; children: React.ReactNode; full?: boolean } )
{
    return (
        <label className={ `block text-xs text-zinc-600 font-medium${ full ? ' col-span-2' : '' }` }>
            { label }
            <div className="mt-1">{ children }</div>
        </label>
    );
}

const variantKey = ( color: string, size: string ) => JSON.stringify( [ color, size ] );

export function ProductForm ( { initialData }: { initialData?: Product } )
{
    const router = useRouter();
    const [ loading, setLoading ] = useState( false );

    // Images
    const [ mainImage, setMainImage ] = useState<string | null>( initialData?.image || null );
    const [ gallery, setGallery ] = useState<string[]>( ( initialData?.images || [] ).filter( image => image !== initialData?.image ) );
    const [ sizeChart, setSizeChart ] = useState<string | null>( initialData?.size_chart || null );

    // Variants
    const [ selectedSizes, setSelectedSizes ] = useState<string[]>( initialData?.sizes || [] );
    const [ sizeStock, setSizeStock ] = useState<Record<string, number>>( initialData?.sizeStock || {} );
    const [ variantStock, setVariantStock ] = useState<Record<string, number>>(
        () => Object.fromEntries( ( initialData?.inventoryVariants || [] ).map( variant => [ variantKey( variant.color, variant.size ), variant.stockQuantity ] ) )
    );
    const [ selectedColors, setSelectedColors ] = useState<string[]>( initialData?.colors || [] );
    const [ customColor, setCustomColor ] = useState( '' );

    // Category
    const [ selectedCategory, setSelectedCategory ] = useState( PRESET_CATEGORIES.includes( initialData?.category || '' ) ? initialData?.category || '' : '' );
    const [ customCategory, setCustomCategory ] = useState( initialData && !PRESET_CATEGORIES.includes( initialData.category ) ? initialData.category : '' );
    const [ selectedSubcategory, setSelectedSubcategory ] = useState( PRESET_SUBCATEGORIES.includes( initialData?.subcategory || '' ) ? initialData?.subcategory || '' : '' );
    const [ customSubcategory, setCustomSubcategory ] = useState( initialData?.subcategory && !PRESET_SUBCATEGORIES.includes( initialData.subcategory ) ? initialData.subcategory : '' );

    // Pricing
    const [ mrp, setMrp ] = useState( String( initialData?.mrp ?? initialData?.price ?? '' ) );
    const [ sellingPrice, setSellingPrice ] = useState( String( initialData?.salePrice ?? initialData?.price ?? '' ) );
    const discount = mrp && sellingPrice
        ? Math.round( ( ( Number( mrp ) - Number( sellingPrice ) ) / Number( mrp ) ) * 100 )
        : 0;

    // Publishing
    const [ status, setStatus ] = useState<'draft' | 'published'>( initialData?.status || 'draft' );

    const toBase64 = ( file: File ): Promise<string> =>
        new Promise( resolve =>
        {
            const r = new FileReader();
            r.onloadend = () => resolve( r.result as string );
            r.readAsDataURL( file );
        } );

    const handleGallery = async ( e: React.ChangeEvent<HTMLInputElement> ) =>
    {
        const files = Array.from( e.target.files || [] );
        const results = await Promise.all( files.map( toBase64 ) );
        setGallery( prev => [ ...prev, ...results ] );
    };

    const toggleSize = ( s: string ) =>
    {
        if ( selectedSizes.includes( s ) )
        {
            setSelectedSizes( prev => prev.filter( x => x !== s ) );
            setSizeStock( prev => { const val = { ...prev }; delete val[ s ]; return val; } );
            setVariantStock( prev =>
            {
                const next = { ...prev };
                selectedColors.forEach( color => delete next[ variantKey( color, s ) ] );
                return next;
            } );
        } else
        {
            setSelectedSizes( prev => [ ...prev, s ] );
            setSizeStock( prev => ( { ...prev, [ s ]: 0 } ) );
            setVariantStock( prev =>
            {
                const next = { ...prev };
                selectedColors.forEach( color => { next[ variantKey( color, s ) ] = 0; } );
                return next;
            } );
        }
    };

    const toggleColor = ( c: string ) =>
    {
        if ( selectedColors.includes( c ) )
        {
            setSelectedColors( prev => prev.filter( x => x !== c ) );
            setVariantStock( prev =>
            {
                const next = { ...prev };
                selectedSizes.forEach( size => delete next[ variantKey( c, size ) ] );
                return next;
            } );
        } else
        {
            setSelectedColors( prev => [ ...prev, c ] );
            setVariantStock( prev =>
            {
                const next = { ...prev };
                selectedSizes.forEach( size => { next[ variantKey( c, size ) ] = 0; } );
                return next;
            } );
        }
    };

    const addCustomColor = () =>
    {
        if ( customColor.trim() && !selectedColors.includes( customColor.trim() ) )
        {
            setSelectedColors( prev => [ ...prev, customColor.trim() ] );
            setVariantStock( prev =>
            {
                const next = { ...prev };
                selectedSizes.forEach( size => { next[ variantKey( customColor.trim(), size ) ] = 0; } );
                return next;
            } );
            setCustomColor( '' );
        }
    };

    const submit = async ( e: FormEvent<HTMLFormElement> ) =>
    {
        e.preventDefault();
        setLoading( true );
        const fd = new FormData( e.currentTarget );

        const finalCategory = customCategory.trim() || selectedCategory;
        const finalSubcategory = customSubcategory.trim() || selectedSubcategory;

        if ( !finalCategory ) { alert( 'Please select or enter a category.' ); setLoading( false ); return; }
        if ( !mainImage ) { alert( 'Please upload a main product image.' ); setLoading( false ); return; }
        if ( selectedSizes.length === 0 ) { alert( 'Please select at least one size.' ); setLoading( false ); return; }
        if ( selectedColors.length === 0 ) { alert( 'Please select at least one color.' ); setLoading( false ); return; }

        const rawData = {
            name: fd.get( 'name' ) as string,
            slug: ( fd.get( 'name' ) as string ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /(^-|-$)/g, '' ),
            sku: ( fd.get( 'sku' ) as string ).trim().toUpperCase(),
            category: finalCategory,
            subcategory: finalSubcategory,
            gender: fd.get( 'gender' ) as string,
            short_description: fd.get( 'short_description' ) as string,
            description: fd.get( 'description' ) as string,

            // Pricing
            mrp: Number( fd.get( 'mrp' ) ),
            price: Number( fd.get( 'selling_price' ) ),
            salePrice: Number( fd.get( 'selling_price' ) ),
            cost_price: fd.get( 'cost_price' ) ? Number( fd.get( 'cost_price' ) ) : null,
            discount,
            gst: fd.get( 'gst' ) as string,

            // Variants
            sizes: selectedSizes,
            colors: selectedColors,
            sizeStock,
            variantStock: Object.fromEntries( selectedColors.flatMap( color => selectedSizes.map( size => [
                variantKey( color, size ),
                Number( variantStock[ variantKey( color, size ) ] ?? 0 ),
            ] ) ) ),
            stock_quantity: Object.values( variantStock ).reduce( ( total, quantity ) => total + ( Number( quantity ) || 0 ), 0 ),
            low_stock_alert: Number( fd.get( 'low_stock_alert' ) ),
            stock_status: fd.get( 'stock_status' ) as string,

            // Images
            image: mainImage,
            images: [ mainImage, ...gallery ].filter( Boolean ),
            size_chart: sizeChart,

            // Product Details
            fabric: fd.get( 'fabric' ) as string,
            material: fd.get( 'material' ) as string,
            fit: fd.get( 'fit' ) as string,
            pattern: fd.get( 'pattern' ) as string,
            sleeve: fd.get( 'sleeve' ) as string,
            collar: fd.get( 'collar' ) as string,
            occasion: fd.get( 'occasion' ) as string,
            season: fd.get( 'season' ) as string,
            styleOrigin: initialData?.styleOrigin || 'Scotland',

            // Shipping
            weight: fd.get( 'weight' ) as string,
            dimensions: fd.get( 'dimensions' ) as string,
            cod: fd.get( 'cod' ) === 'yes',

            // SEO
            seo_title: fd.get( 'seo_title' ) as string,
            meta_description: fd.get( 'meta_description' ) as string,
            tags: ( fd.get( 'tags' ) as string ).split( ',' ).map( t => t.trim() ).filter( Boolean ),

            // Publishing
            status,
            featured: ( e.currentTarget.querySelector( '#featured' ) as HTMLInputElement )?.checked,
            isNew: ( e.currentTarget.querySelector( '#new_arrival' ) as HTMLInputElement )?.checked,
            best_seller: ( e.currentTarget.querySelector( '#best_seller' ) as HTMLInputElement )?.checked,

            rating: 4.5,
            reviews: 0,
        };

        try
        {
            const res = await fetch( initialData ? `/api/admin/products/${ initialData.id }` : '/api/admin/products', {
                method: initialData ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( rawData ),
            } );
            if ( res.ok )
            {
                alert( initialData ? '✅ Product updated successfully!' : '✅ Product saved successfully!' );
                router.push( '/admin/products' );
            } else
            {
                const err = await res.json().catch( () => ( { error: 'Could not save product.' } ) );
                alert( err.error || 'Could not save product.' );
                setLoading( false );
            }
        } catch
        {
            alert( 'Network Error' );
            setLoading( false );
        }
    };

    return (
        <form onSubmit={ submit } className="mt-8 max-w-4xl space-y-6">

            {/* ── 1. Basic Information ── */ }
            <SectionCard title="📋 Basic Information">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Product Name *">
                        <input name="name" required className="input w-full" placeholder="e.g. Glen Brushed Overshirt" defaultValue={ initialData?.name } />
                    </Field>
                    <Field label="SKU *">
                        <input name="sku" required className="input w-full" placeholder="SC-001" defaultValue={ initialData?.sku } />
                    </Field>

                    {/* Category */ }
                    <div className="sm:col-span-2 space-y-1">
                        <p className="text-xs text-zinc-600 font-medium">Category *</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                                <p className="text-[10px] text-zinc-400 mb-1">Select from list</p>
                                <select className="input w-full" value={ selectedCategory } onChange={ e => { setSelectedCategory( e.target.value ); setCustomCategory( '' ); } }>
                                    <option value="">-- Select --</option>
                                    { PRESET_CATEGORIES.map( c => <option key={ c } value={ c }>{ c }</option> ) }
                                </select>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-400 mb-1">Or type custom</p>
                                <input className="input w-full" placeholder="e.g. Ethnic Wear..." value={ customCategory } onChange={ e => { setCustomCategory( e.target.value ); setSelectedCategory( '' ); } } />
                            </div>
                        </div>
                        { ( customCategory.trim() || selectedCategory ) && (
                            <p className="text-[11px] text-green-700">✓ Category: <strong>{ customCategory.trim() || selectedCategory }</strong></p>
                        ) }
                    </div>

                    {/* Subcategory */ }
                    <div className="sm:col-span-2 space-y-1">
                        <p className="text-xs text-zinc-600 font-medium">Subcategory</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                                <p className="text-[10px] text-zinc-400 mb-1">Select from list</p>
                                <select className="input w-full" value={ selectedSubcategory } onChange={ e => { setSelectedSubcategory( e.target.value ); setCustomSubcategory( '' ); } }>
                                    <option value="">-- Select --</option>
                                    { PRESET_SUBCATEGORIES.map( c => <option key={ c } value={ c }>{ c }</option> ) }
                                </select>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-400 mb-1">Or type custom</p>
                                <input className="input w-full" placeholder="e.g. Half Shirt, Baggy..." value={ customSubcategory } onChange={ e => { setCustomSubcategory( e.target.value ); setSelectedSubcategory( '' ); } } />
                            </div>
                        </div>
                    </div>

                    <Field label="Gender *">
                        <select name="gender" required className="input w-full" defaultValue={ initialData?.gender || '' }>
                            <option value="">-- Select --</option>
                            <option value="Men">Men</option>
                            <option value="Women">Women</option>
                            <option value="Boy">Boy</option>
                            <option value="Girl">Girl</option>
                            <option value="Child">Child</option>
                            <option value="Unisex">Unisex</option>
                        </select>
                    </Field>

                    <Field label="Short Description">
                        <input name="short_description" className="input w-full" placeholder="One-line product summary" defaultValue={ initialData?.shortDescription } />
                    </Field>

                    <Field label="Description *" full>
                        <textarea name="description" required minLength={ 10 } className="input w-full min-h-28" placeholder="Detailed product description (min 10 chars)" defaultValue={ initialData?.description } />
                    </Field>
                </div>
            </SectionCard>

            {/* ── 2. Pricing ── */ }
            <SectionCard title="💰 Pricing">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="MRP (₹) *">
                        <input name="mrp" required type="number" min="1" className="input w-full" placeholder="999" value={ mrp } onChange={ e => setMrp( e.target.value ) } />
                    </Field>
                    <Field label="Selling Price (₹) *">
                        <input name="selling_price" required type="number" min="1" className="input w-full" placeholder="799" value={ sellingPrice } onChange={ e => setSellingPrice( e.target.value ) } />
                    </Field>
                    <Field label="Cost Price (₹) — optional">
                        <input name="cost_price" type="number" min="0" className="input w-full" placeholder="400" defaultValue={ initialData?.cost_price } />
                    </Field>
                    <Field label="Discount">
                        <div className="input w-full bg-zinc-50 flex items-center gap-2">
                            <span className={ `font-bold text-sm ${ discount > 0 ? 'text-green-600' : 'text-zinc-400' }` }>
                                { discount > 0 ? `${ discount }% OFF` : '—' }
                            </span>
                            <span className="text-[10px] text-zinc-400">(auto-calculated)</span>
                        </div>
                    </Field>
                    <Field label="GST">
                        <select name="gst" className="input w-full" defaultValue={ initialData?.gst || '0%' }>
                            { GST_OPTIONS.map( g => <option key={ g } value={ g }>{ g }</option> ) }
                        </select>
                    </Field>
                </div>
            </SectionCard>

            {/* ── 3. Variants ── */ }
            <SectionCard title="🎨 Variants (Sizes & Colors)">
                {/* Sizes */ }
                <div>
                    <p className="text-xs text-zinc-600 font-medium mb-2">Sizes * <span className="text-zinc-400 font-normal">(select all that apply)</span></p>
                    <div className="flex flex-wrap gap-2">
                        { selectedSizes.filter( size => !SIZES_LIST.includes( size ) ).map( size => (
                            <button key={ size } type="button" onClick={ () => toggleSize( size ) }
                                className="h-9 w-12 border border-navy bg-navy text-xs font-mono text-white transition">
                                { size }
                            </button>
                        ) ) }
                        { SIZES_LIST.map( s => (
                            <button key={ s } type="button" onClick={ () => toggleSize( s ) }
                                className={ `h-9 w-12 border text-xs font-mono transition ${ selectedSizes.includes( s ) ? 'border-navy bg-navy text-white' : 'border-stone hover:border-navy' }` }>
                                { s }
                            </button>
                        ) ) }
                    </div>
                    { selectedSizes.length > 0 && <p className="mt-2 text-[11px] text-green-700">✓ Selected: <strong>{ selectedSizes.join( ', ' ) }</strong></p> }
                </div>

                {/* Colors */ }
                <div>
                    <p className="text-xs text-zinc-600 font-medium mb-2">Colors * <span className="text-zinc-400 font-normal">(select all that apply)</span></p>
                    <div className="flex flex-wrap gap-2">
                        { COLORS_LIST.map( c => (
                            <button key={ c } type="button" onClick={ () => toggleColor( c ) }
                                className={ `border px-3 py-1.5 text-xs transition ${ selectedColors.includes( c ) ? 'border-navy bg-navy text-white' : 'border-stone hover:border-navy' }` }>
                                { c }
                            </button>
                        ) ) }
                        { selectedColors.filter( color => !COLORS_LIST.includes( color ) ).map( color => (
                            <button key={ color } type="button" onClick={ () => toggleColor( color ) }
                                className="border border-navy bg-navy px-3 py-1.5 text-xs text-white transition">
                                { color }
                            </button>
                        ) ) }
                    </div>
                    <div className="mt-3 flex gap-2">
                        <input className="input flex-1" placeholder="Add custom color (e.g. Cobalt Blue)" value={ customColor } onChange={ e => setCustomColor( e.target.value ) } onKeyDown={ e => e.key === 'Enter' && ( e.preventDefault(), addCustomColor() ) } />
                        <button type="button" onClick={ addCustomColor } className="border border-navy text-navy px-4 text-xs hover:bg-navy hover:text-white transition">+ Add</button>
                    </div>
                    { selectedColors.length > 0 && <p className="mt-2 text-[11px] text-green-700">✓ Selected: <strong>{ selectedColors.join( ', ' ) }</strong></p> }
                </div>

                { selectedSizes.length > 0 && selectedColors.length > 0 && (
                    <div className="bg-zinc-50 p-4 border border-stone rounded">
                        <p className="text-xs text-navy font-semibold uppercase tracking-wider mb-3">Stock per Color and Size</p>
                        <div className="space-y-4">
                            { selectedColors.map( color => (
                                <div key={ color }>
                                    <p className="mb-2 text-xs font-semibold text-zinc-600">{ color }</p>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        { selectedSizes.map( size => {
                                            const key = variantKey( color, size );
                                            return (
                                                <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest" key={ key }>
                                                    { size } Size
                                                    <input
                                                        type="number" min="0" step="1"
                                                        className="input w-full mt-1 bg-white"
                                                        value={ variantStock[ key ] ?? 0 }
                                                        onChange={ event => setVariantStock( current => ( { ...current, [ key ]: Math.max( 0, Number( event.target.value ) || 0 ) } ) ) }
                                                    />
                                                </label>
                                            );
                                        } ) }
                                    </div>
                                </div>
                            ) ) }
                        </div>
                        <p className="mt-4 border-t border-stone pt-3 text-sm font-semibold text-navy">
                            Total stock: { selectedColors.reduce( ( total, color ) => total + selectedSizes.reduce(
                                ( sizeTotal, size ) => sizeTotal + ( Number( variantStock[ variantKey( color, size ) ] ) || 0 ),
                                0
                            ), 0 ) }
                        </p>
                    </div>
                ) }
            </SectionCard>

            {/* ── 4. Images ── */ }
            <SectionCard title="🖼️ Images">
                {/* Main Image */ }
                <div>
                    <p className="text-xs text-zinc-600 font-medium mb-2">Main Image *</p>
                    <label className="block border border-dashed border-stone rounded p-4 text-center text-xs text-zinc-500 cursor-pointer hover:border-navy transition">
                        { mainImage
                            ? <img src={ mainImage } alt="Main" className="mx-auto h-36 object-contain rounded" />
                            : <span>Click to upload main image</span> }
                        <input type="file" accept="image/*" className="hidden" onChange={ async e =>
                        {
                            const f = e.target.files?.[ 0 ];
                            if ( f ) setMainImage( await toBase64( f ) );
                        } } />
                    </label>
                </div>

                {/* Gallery */ }
                <div>
                    <p className="text-xs text-zinc-600 font-medium mb-2">Gallery Images</p>
                    <div className="flex flex-wrap gap-3 mb-3">
                        { gallery.map( ( src, i ) => (
                            <div key={ i } className="relative group">
                                <img src={ src } alt={ `Gallery ${ i + 1 }` } className="h-20 w-20 object-cover rounded border border-stone" />
                                <button type="button" onClick={ () => setGallery( p => p.filter( ( _, j ) => j !== i ) ) }
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center">✕</button>
                            </div>
                        ) ) }
                        <label className="h-20 w-20 border border-dashed border-stone rounded flex items-center justify-center text-2xl text-zinc-400 cursor-pointer hover:border-navy transition">
                            +
                            <input type="file" multiple accept="image/*" className="hidden" onChange={ handleGallery } />
                        </label>
                    </div>
                </div>

                {/* Size Chart */ }
                <div>
                    <p className="text-xs text-zinc-600 font-medium mb-2">Size Chart Image</p>
                    <label className="block border border-dashed border-stone rounded p-4 text-center text-xs text-zinc-500 cursor-pointer hover:border-navy transition">
                        { sizeChart
                            ? <img src={ sizeChart } alt="Size Chart" className="mx-auto h-24 object-contain rounded" />
                            : <span>Upload size chart (optional)</span> }
                        <input type="file" accept="image/*" className="hidden" onChange={ async e =>
                        {
                            const f = e.target.files?.[ 0 ];
                            if ( f ) setSizeChart( await toBase64( f ) );
                        } } />
                    </label>
                </div>
            </SectionCard>

            {/* ── 5. Product Details ── */ }
            <SectionCard title="👕 Product Details">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    { [
                        { name: 'fabric', label: 'Fabric', placeholder: 'e.g. 100% Cotton', value: initialData?.fabric },
                        { name: 'material', label: 'Material', placeholder: 'e.g. Woven', value: initialData?.material },
                        { name: 'fit', label: 'Fit', placeholder: 'e.g. Regular / Slim / Oversized', value: initialData?.fit },
                        { name: 'pattern', label: 'Pattern', placeholder: 'e.g. Solid / Striped / Checked', value: initialData?.pattern },
                        { name: 'sleeve', label: 'Sleeve', placeholder: 'e.g. Half / Full / Sleeveless', value: initialData?.sleeve },
                        { name: 'collar', label: 'Collar', placeholder: 'e.g. Round / Polo / Mandarin', value: initialData?.collar },
                        { name: 'occasion', label: 'Occasion', placeholder: 'e.g. Casual / Formal / Party', value: initialData?.occasion },
                        { name: 'season', label: 'Season', placeholder: 'e.g. Summer / Winter / All Season', value: initialData?.season },
                        { name: 'styleOrigin', label: 'Style Origin', placeholder: 'e.g. Scotland', value: initialData?.styleOrigin },
                    ].map( f => (
                        <Field key={ f.name } label={ f.label }>
                            <input name={ f.name } className="input w-full" placeholder={ f.placeholder } defaultValue={ f.value || '' } />
                        </Field>
                    ) ) }
                </div>
            </SectionCard>

            {/* ── 6. Inventory ── */ }
            <SectionCard title="📦 Inventory">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Low Stock Alert">
                        <input name="low_stock_alert" type="number" min="0" className="input w-full" placeholder="10" defaultValue={ initialData?.low_stock_alert ?? 10 } />
                    </Field>
                    <Field label="Stock Status">
                        <select name="stock_status" className="input w-full" defaultValue={ initialData?.stock_status || 'in_stock' }>
                            <option value="in_stock">In Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                            <option value="preorder">Pre-Order</option>
                        </select>
                    </Field>
                </div>
            </SectionCard>

            {/* ── 7. Shipping ── */ }
            <SectionCard title="🚚 Shipping">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Weight (grams)">
                        <input name="weight" type="text" className="input w-full" placeholder="e.g. 300g" defaultValue={ initialData?.weight } />
                    </Field>
                    <Field label="Dimensions (cm)">
                        <input name="dimensions" type="text" className="input w-full" placeholder="L × W × H" defaultValue={ initialData?.dimensions } />
                    </Field>
                    <Field label="Cash on Delivery">
                        <select name="cod" className="input w-full" defaultValue={ initialData?.cod === false ? 'no' : 'yes' }>
                            <option value="yes">Available</option>
                            <option value="no">Not Available</option>
                        </select>
                    </Field>
                </div>
            </SectionCard>

            {/* ── 8. SEO ── */ }
            <SectionCard title="🔍 SEO">
                <div className="grid gap-4">
                    <Field label="SEO Title">
                        <input name="seo_title" className="input w-full" placeholder="e.g. Buy Glen Brushed Overshirt Online – Scotland" defaultValue={ initialData?.seo_title } />
                    </Field>
                    <Field label="Meta Description">
                        <textarea name="meta_description" className="input w-full min-h-16" placeholder="Brief description for search engines (max 160 chars)" maxLength={ 160 } defaultValue={ initialData?.meta_description } />
                    </Field>
                    <Field label="Tags (comma separated)">
                        <input name="tags" className="input w-full" placeholder="e.g. shirt, men fashion, casual wear, scotland" defaultValue={ initialData?.tags?.join( ', ' ) } />
                    </Field>
                </div>
            </SectionCard>

            {/* ── 9. Publishing ── */ }
            <SectionCard title="🚀 Publishing">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Status">
                        <div className="flex gap-3 mt-1">
                            { ( [ 'draft', 'published' ] as const ).map( s => (
                                <button key={ s } type="button" onClick={ () => setStatus( s ) }
                                    className={ `flex-1 py-2 border text-xs capitalize transition ${ status === s ? 'bg-navy border-navy text-white' : 'border-stone hover:border-navy' }` }>
                                    { s === 'draft' ? '📝 Draft' : '✅ Published' }
                                </button>
                            ) ) }
                        </div>
                    </Field>

                    <div className="flex flex-col gap-3 pt-1">
                        { [
                            { id: 'featured', label: '⭐ Featured Product' },
                            { id: 'new_arrival', label: '🆕 New Arrival' },
                            { id: 'best_seller', label: '🔥 Best Seller' },
                        ].map( ( { id, label } ) => (
                            <label key={ id } className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                    id={ id }
                                    type="checkbox"
                                    className="h-4 w-4 accent-navy"
                                    defaultChecked={ id === 'featured' ? initialData?.featured : id === 'new_arrival' ? initialData?.isNew : initialData?.best_seller }
                                />
                                { label }
                            </label>
                        ) ) }
                    </div>
                </div>
            </SectionCard>

            {/* Submit */ }
            <div className="flex gap-3 pb-8">
                <button type="submit" disabled={ loading } className="button flex-1">
                    { loading ? 'Saving...' : initialData ? '💾 Update Product' : status === 'published' ? '🚀 Publish Product' : '💾 Save as Draft' }
                </button>
                <button type="button" onClick={ () => router.back() } className="border border-stone px-6 py-2 text-xs hover:border-navy transition">
                    Cancel
                </button>
            </div>

        </form>
    );
}
