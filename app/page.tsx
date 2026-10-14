import Image from 'next/image';
import Link from 'next/link';
import { getAllProducts } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import { ItalianComboOutfits } from '@/components/ItalianComboOutfits';
import { RotatingHeroSection } from '@/components/RotatingHeroSection';
import { CampaignSlider } from '@/components/CampaignSlider';

export const dynamic = 'force-dynamic';

const heroImages = [
  {
    src: '/images/hero/photo-1496747611176-843222e1e57c.webp',
    alt: 'Woman in a floral summer dress by the sea'
  },
  {
    src: '/images/hero/man-cafe-linen.jpg',
    alt: 'Man in white linen shirt at cafe'
  },
  {
    src: '/images/hero/man-luxury-car.jpg',
    alt: 'Man in pinstriped shirt and jeans by luxury car'
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
  const products = await getAllProducts();
  const dailyProducts = getDailyProducts( products );

  // Naye added products sbse aakhri me aate hain array me, isliye reverse karke sabse naye wale pehle show honge. 
  // Hum pehle `isNew` wale prioritize kar sakte hain ya fir sirf naye added (reverse order).
  // Yaha hum automatically list ko reverse kar rahe hai taaki jo sabse latest add hue hai, wo sabse upar(new arrival) aaye.
  const newArrivalProducts = [ ...products ].reverse();
  return <main>
    <RotatingHeroSection images={ heroImages } autoRotateInterval={ 5000 } />

    <ItalianComboOutfits />

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

    <CampaignSlider />

    <section className="shell py-12">
      <div className="flex items-end justify-between"><div><p className="eyebrow">New season</p><h2 className="display mt-3 text-4xl">New arrivals</h2></div><Link className="eyebrow border-b border-navy pb-1" href="/shop">View all pieces</Link></div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{ newArrivalProducts.slice( 0, 12 ).map( product => <ProductCard key={ product.id } product={ product } /> ) }</div>
    </section>

    <section className="flex flex-col-reverse bg-navy text-white lg:grid lg:grid-cols-2">
      <div className="px-6 pb-10 lg:p-0 flex flex-col justify-center">
        <div className="relative overflow-hidden w-full aspect-[4/5] lg:aspect-auto lg:min-h-[100%] h-full sm:min-h-[450px]">
          <Image src="/images/italian-looks/cafe-linen-set.jpeg" alt="Italian linen summer outfit" fill className="object-cover brightness-90 lg:brightness-75" sizes="50vw" />
        </div>
      </div>
      <div className="flex items-center px-6 pt-14 pb-8 sm:p-20"><div><p className="eyebrow text-stone/70">The complete look</p><h2 className="mt-3 font-display text-4xl sm:text-5xl leading-[1.1]">The Edinburgh<br />weekender.</h2><p className="mt-4 max-w-sm leading-6 text-stone/90">Easy layers for unplanned detours. A brushed overshirt, relaxed trouser and hardwearing leather boot, selected to work as one.</p><Link className="button mt-8 bg-cream text-navy hover:text-white" href="/complete-looks">Shop this look</Link></div></div>
    </section>

    <section className="shell py-20"><div className="grid items-center gap-10 lg:grid-cols-2"><div><p className="eyebrow">Our point of view</p><h2 className="display mt-4 text-5xl">Heritage, without<br />the costume.</h2><p className="mt-5 max-w-md leading-7 text-zinc-600">We take our cues from the changing Scottish landscape: stormy blues, peat browns and unexpected Highland reds. The result is a wardrobe that feels quietly distinctive, anywhere in the world.</p><Link className="eyebrow mt-6 inline-block border-b border-navy pb-1" href="/about">Meet SCOTLAND</Link></div><div className="relative min-h-[300px] w-full overflow-hidden sm:min-h-[390px]" style={ { backgroundImage: 'url("/images/hero/photo-1506377585622-bedcbb027afc.webp")', backgroundPosition: 'center', backgroundSize: 'cover' } }><Image src="/images/hero/photo-1506377585622-bedcbb027afc.webp" alt="Edinburgh skyline at sunset" fill className="object-cover" sizes="50vw" /></div></div></section>
  </main>;
}
