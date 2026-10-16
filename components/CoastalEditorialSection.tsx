import Image from 'next/image';
import Link from 'next/link';

export function CoastalEditorialSection ()
{
    return (
        <section className="bg-[#f2efe8] py-12 sm:py-16 lg:py-20">
            <div className="shell">
                <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
                    <div className="py-2 sm:py-6">
                        <div className="flex items-center gap-3">
                            <span className="h-px w-8 bg-[#a88b55]" />
                            <p className="eyebrow text-[#8b744b]">The Scotland journal · 01</p>
                        </div>

                        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 sm:mt-14">
                            A change of scenery
                        </p>
                        <h2 className="display mt-4 max-w-xl text-5xl leading-[0.98] sm:text-6xl lg:text-[4.5rem]">
                            Made for the
                            <br />
                            <span className="italic text-[#92784b]">open horizon.</span>
                        </h2>
                        <p className="mt-6 max-w-md text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                            Relaxed tailoring and breathable layers for bright horizons, salt air and slow departures.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                            <Link
                                className="group inline-flex items-center gap-4 border-b border-navy pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-navy transition hover:border-[#92784b] hover:text-[#92784b]"
                                href="/shop"
                            >
                                Shop the coastal edit
                                <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">→</span>
                            </Link>
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Spring · Summer</span>
                        </div>

                        <div className="mt-10 grid max-w-md grid-cols-3 border-t border-[#d8d2c5] pt-5 sm:mt-14">
                            <div>
                                <span className="font-display text-xl text-navy">01</span>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Easy layers</p>
                            </div>
                            <div className="border-l border-[#d8d2c5] pl-4 sm:pl-6">
                                <span className="font-display text-xl text-navy">02</span>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Soft tailoring</p>
                            </div>
                            <div className="border-l border-[#d8d2c5] pl-4 sm:pl-6">
                                <span className="font-display text-xl text-navy">03</span>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Slow escapes</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative mx-auto w-full max-w-2xl pb-8 pl-8 sm:pb-10 sm:pl-10">
                        <div className="relative aspect-[4/3] overflow-hidden bg-[#ded8cc] sm:aspect-[1.18/1]">
                            <Image
                                src="/images/hero/coastal-yacht.jpeg"
                                alt="A quiet coastal escape aboard a yacht"
                                fill
                                priority={ false }
                                className="object-cover"
                                sizes="(max-width: 1024px) 100vw, 54vw"
                            />
                        </div>
                        <div className="absolute bottom-0 left-0 w-[36%] border-[5px] border-[#f2efe8] bg-[#f2efe8] p-1 sm:border-[7px] sm:p-1.5">
                            <div className="relative aspect-[4/5] overflow-hidden bg-[#ded8cc]">
                                <Image
                                    src="/images/hero/mountain-drive.jpeg"
                                    alt="A considered look for a weekend away"
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 36vw, 220px"
                                />
                            </div>
                        </div>
                        <span className="absolute right-0 top-0 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                            The coastal edit · 01
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
