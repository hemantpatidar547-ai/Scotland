import Link from 'next/link';

const looks = [
  { image: '/images/italian-looks/evening-knit-polo.jpeg', title: 'The evening polo', detail: 'Textured knit polo, black tailored trousers and polished loafers.' },
  { image: '/images/italian-looks/lake-navy-polo.jpeg', title: 'Lake Como navy', detail: 'Navy polo with airy white trousers for a clean resort silhouette.' },
  { image: '/images/italian-looks/cafe-linen-set.jpeg', title: 'The linen cafe set', detail: 'Open-collar linen shirt, cream trousers and leather loafers.' },
  { image: '/images/italian-looks/green-resort-shirt.jpeg', title: 'Resort green', detail: 'A statement resort shirt balanced by relaxed linen trousers.' },
  { image: '/images/italian-looks/coastal-blue-shirt.jpeg', title: 'Coastal blue', detail: 'Light-blue shirt and white trousers: effortless Mediterranean contrast.' },
];

export function ItalianComboOutfits() {
  return <section className="border-t border-stone bg-[#f2eee7] py-12 sm:py-16">
    <div className="shell">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="eyebrow">Italian summer edit</p><h2 className="display mt-2 text-3xl sm:text-4xl">Italian combo outfits.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">Linen shirts, textured polos and relaxed tailoring—finished with understated footwear for an effortless Italian summer look.</p></div>
        <Link className="button w-fit" href="/shop">Shop Italian pieces</Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {looks.map(look => <article key={look.title} className="group"><div className="relative aspect-[.76] overflow-hidden bg-stone"><img src={look.image} alt={look.title} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-3 pb-3 pt-12"><p className="font-display text-lg text-white">{look.title}</p></div></div><p className="mt-2 text-xs leading-5 text-zinc-600">{look.detail}</p></article>)}
      </div>
    </div>
  </section>;
}
