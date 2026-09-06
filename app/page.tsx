import Image from 'next/image';
import Link from 'next/link';
import { products } from '@/lib/products';
import { ProductCard } from '@/components/ProductCard';
import { ItalianComboOutfits } from '@/components/ItalianComboOutfits';
import { RotatingHeroSection } from '@/components/RotatingHeroSection';

const categoryTiles = [
  ['Shirts', 'Oxford, camp collar & boxy shirts'], ['T-shirts', 'Heavyweight, fitted & relaxed tees'],
  ['Trousers', 'Formal, pleated & relaxed pants'], ['Jeans', 'Straight, wide-leg & selvedge denim'],
  ['Bootcut pants', 'Tailored flare silhouettes'], ['Shorts', 'Easy summer & utility shorts'],
  ['Shoes', 'Sneakers, loafers & formal shoes'], ['Boots', 'Leather, hiking & city boots'],
  ['Jackets', 'Denim, field & tailored layers'], ['Bags & extras', 'Watches, belts, bags and scarves'],
];

const heroImages = [
  {
    src: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1800&q=85',
    alt: 'Model wearing SCOTLAND collection'
  },
  {
    src: '/images/hero/woman-italian-cafe.jpg',
    alt: 'Woman in blue and white dress in Italian café'
  },
  {
    src: '/images/hero/man-cafe-linen.jpg',
    alt: 'Man in white linen shirt at café'
  },
  {
    src: '/images/hero/man-luxury-car.jpg',
    alt: 'Man in pinstriped shirt and jeans by luxury car'
  }
];

export default function Home() {
  return <main>
    <RotatingHeroSection images={heroImages} autoRotateInterval={5000} />

    <ItalianComboOutfits />

    <section className="shell py-20">
      <div className="flex items-end justify-between"><div><p className="eyebrow">Find your category</p><h2 className="display mt-3 text-4xl">A fuller wardrobe.</h2></div><Link className="eyebrow border-b border-navy pb-1" href="/shop">Shop all categories</Link></div>
      <div className="mt-8 grid border-l border-t border-stone sm:grid-cols-2 lg:grid-cols-5">{categoryTiles.map(([title, sub], index) => <Link href="/shop" key={title} className={`group min-h-36 border-b border-r border-stone p-5 transition hover:bg-navy hover:text-white ${index === 0 ? 'bg-[#e7e1d5]' : ''}`}><span className="font-mono text-[10px] text-gold">0{index + 1}</span><h3 className="mt-5 font-display text-2xl leading-none">{title}</h3><p className="mt-2 text-xs leading-5 opacity-65">{sub}</p><span className="mt-3 block text-xs transition group-hover:translate-x-1">Explore →</span></Link>)}</div>
    </section>

    <section className="shell py-20">
      <div className="flex items-end justify-between"><div><p className="eyebrow">New season</p><h2 className="display mt-3 text-4xl">New arrivals</h2></div><Link className="eyebrow border-b border-navy pb-1" href="/shop">View all pieces</Link></div>
      <div className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-4">{products.slice(0, 4).map(product => <ProductCard key={product.id} product={product} />)}</div>
    </section>

    <section className="grid bg-navy text-white lg:grid-cols-2">
      <div className="relative min-h-[450px]"><Image src="/images/italian-looks/cafe-linen-set.jpeg" alt="Italian linen summer outfit" fill className="object-cover brightness-75" sizes="50vw" /></div>
      <div className="flex items-center p-10 sm:p-20"><div><p className="eyebrow">The complete look</p><h2 className="mt-4 font-display text-5xl leading-none">The Edinburgh<br />weekender.</h2><p className="mt-5 max-w-sm leading-6 text-stone">Easy layers for unplanned detours. A brushed overshirt, relaxed trouser and hardwearing leather boot, selected to work as one.</p><Link className="button mt-7 bg-cream text-navy hover:text-white" href="/complete-looks">Shop this look</Link></div></div>
    </section>

    <section className="shell py-20"><div className="grid items-center gap-10 lg:grid-cols-2"><div><p className="eyebrow">Our point of view</p><h2 className="display mt-4 text-5xl">Heritage, without<br />the costume.</h2><p className="mt-5 max-w-md leading-7 text-zinc-600">We take our cues from the changing Scottish landscape: stormy blues, peat browns and unexpected Highland reds. The result is a wardrobe that feels quietly distinctive, anywhere in the world.</p><Link className="eyebrow mt-6 inline-block border-b border-navy pb-1" href="/about">Meet SCOTLAND</Link></div><div className="relative min-h-[390px]"><Image src="https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80" alt="Scottish highlands" fill className="object-cover" sizes="50vw" /></div></div></section>
  </main>;
}
