import Image from 'next/image';
import Link from 'next/link';
import { getAllProducts } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import { ProductLaunchShowcase } from '@/components/ProductLaunchShowcase';
import { RotatingHeroSection } from '@/components/RotatingHeroSection';
import { CoastalEditorialSection } from '@/components/CoastalEditorialSection';
import { getRecentlyUpdatedProducts } from '@/lib/product-recommendations';
import { getHomepageShowcase } from '@/lib/homepage-showcase';

export const revalidate = 60;

const heroImages = [
  {
    src: '/images/hero/mens-beachwear.webp',
    alt: 'Man walking along a beach in casual menswear'
  },
  {
    src: '/images/hero/menswear-beach-02.jpg',
    alt: 'Man in a striped shirt and relaxed trousers on the beach'
  },
  {
    src: '/images/hero/menswear-city-03.jpg',
    alt: 'Man in a light casual outfit walking through a European city'
  },
  {
    src: '/images/hero/menswear-home-04.jpg',
    alt: 'Man in casual modern clothing at home'
  }
];

function getDailyProducts ( products: Awaited<ReturnType<typeof getAllProducts>> )
{
  const dayKey = new Date().toISOString().slice( 0, 10 );
  const hash = ( value: string ) =>
  {
    let result = 2166136261;
    for ( const character of value )
    {
      result ^= character.charCodeAt( 0 );
      result = Math.imul( result, 16777619 );
    }
    return result >>> 0;
  };

  return [ ...products ]
    .sort( ( first, second ) => hash( `${ dayKey }:${ first.id }` ) - hash( `${ dayKey }:${ second.id }` ) )
    .slice( 0, 4 );
}

export default async function Home ()
{
  const [ products, homepageShowcase ] = await Promise.all( [
    getAllProducts(),
    getHomepageShowcase(),
  ] );
  const publishedProducts = products.filter( product => product.status === 'published' );
  const dailyProducts = getDailyProducts( publishedProducts );
  const newArrivalProducts = getRecentlyUpdatedProducts( publishedProducts, 12 );
  return <main>
    <RotatingHeroSection images={ heroImages } autoRotateInterval={ 5000 } />

    <section className="shell py-5 sm:py-7">
      <div className="flex flex-col items-center justify-between gap-4 border border-stone bg-cream px-5 py-5 text-center sm:flex-row sm:px-8 sm:text-left">
        <div>
          <p className="eyebrow text-gold">Special offer</p>
          <h2 className="display mt-1 text-2xl sm:text-3xl">Buy 3, get a T-shirt free.</h2>
          <p className="mt-1 text-sm text-zinc-600">Choose any in-stock T-shirt when you add 3 items to your bag.</p>
        </div>
        <Link href="/shop" className="button shrink-0">Shop the collection</Link>
      </div>
    </section>

    <ProductLaunchShowcase content={ homepageShowcase } />

    <section className="py-16 sm:py-24 bg-stone/20">
      <div className="shell flex items-end justify-between">
        <div><p className="eyebrow text-stone/80">Our products</p><h2 className="display mt-3 text-4xl">Best clothes for you.</h2></div>
        <Link className="eyebrow hidden sm:block border-b border-navy pb-1" href="/shop">Explore collection</Link>
      </div>
      <div className="shell mt-10">
        <div className="flex gap-5 overflow-x-auto pb-8 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-visible md:pb-0" style={ { scrollbarWidth: 'none', msOverflowStyle: 'none' } }>
          { dailyProducts.map( product => <div className="min-w-[75vw] snap-start sm:min-w-[45vw] md:min-w-0" key={ product.id }><ProductCard product={ product } /></div> ) }
        </div>
      </div>
    </section>

    <CoastalEditorialSection />

    <section className="shell py-12">
      <div className="flex items-end justify-between"><div><p className="eyebrow">New season</p><h2 className="display mt-3 text-4xl">New arrivals</h2></div><Link className="eyebrow border-b border-navy pb-1" href="/shop">View all pieces</Link></div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{ newArrivalProducts.slice( 0, 12 ).map( product => <ProductCard key={ product.id } product={ product } /> ) }</div>
    </section>

    <section className="flex flex-col-reverse bg-navy text-white lg:grid lg:grid-cols-2">
      <div className="px-6 pb-10 lg:p-0 flex flex-col justify-center">
        <div className="relative overflow-hidden w-full aspect-[4/5] lg:aspect-auto lg:min-h-[100%] h-full sm:min-h-[450px]">
          <img src={ homepageShowcase.featuredImage } alt="Featured collection look" loading="lazy" decoding="async" fetchPriority="low" className="absolute inset-0 h-full w-full object-cover brightness-90 lg:brightness-75" />
        </div>
      </div>
      <div className="flex items-center px-6 pt-14 pb-8 sm:p-20"><div><p className="eyebrow text-stone/70">The complete look</p><h2 className="mt-3 font-display text-4xl sm:text-5xl leading-[1.1]">The Edinburgh<br />weekender.</h2><p className="mt-4 max-w-sm leading-6 text-stone/90">Easy layers for unplanned detours. A brushed overshirt, relaxed trouser and hardwearing leather boot, selected to work as one.</p><Link className="button mt-8 bg-cream text-navy hover:text-white" href="/complete-looks">Shop this look</Link></div></div>
    </section>

    <section className="shell py-20"><div className="grid items-center gap-10 lg:grid-cols-2"><div><p className="eyebrow">Our point of view</p><h2 className="display mt-4 text-5xl">Heritage, without<br />the costume.</h2><p className="mt-5 max-w-md leading-7 text-zinc-600">We take our cues from the changing Scottish landscape: stormy blues, peat browns and unexpected Highland reds. The result is a wardrobe that feels quietly distinctive, anywhere in the world.</p><Link className="eyebrow mt-6 inline-block border-b border-navy pb-1" href="/about">Meet SCOTLAND</Link></div><div className="relative min-h-[300px] w-full overflow-hidden sm:min-h-[390px]"><Image src="/images/hero/photo-1506377585622-bedcbb027afc.webp" alt="Edinburgh skyline at sunset" fill className="object-cover" sizes="50vw" /></div></div></section>
  </main>;
}
