import type { HomepageShowcase } from '@/types/homepage-showcase';

export function ProductLaunchShowcase ( { content }: { content: HomepageShowcase } )
{
    if ( !content.enabled ) return null;

    return <section className="border-t border-stone bg-[#f2eee7] py-12 sm:py-16">
        <div className="shell">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                    <p className="eyebrow">{ content.eyebrow }</p>
                    <h2 className="display mt-2 text-3xl sm:text-4xl">{ content.title }</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
                        { content.description }
                        { content.badge && <span className="ml-2 inline-block rounded bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">{ content.badge }</span> }
                    </p>
                </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                { content.cards.map( ( card, index ) => <article key={ `${ card.title }-${ index }` } className="group">
                    <div className="relative aspect-[.76] overflow-hidden bg-stone">
                        <img src={ card.image } alt={ card.title } className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-3 pb-3 pt-12">
                            <p className="font-display text-lg text-white">{ card.title }</p>
                        </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-600">{ card.detail }</p>
                </article> ) }
            </div>
        </div>
    </section>;
}
