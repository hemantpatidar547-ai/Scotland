'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface HeroImage {
  src: string;
  alt: string;
}

interface RotatingHeroSectionProps {
  images: HeroImage[];
  autoRotateInterval?: number;
}

export function RotatingHeroSection({ 
  images, 
  autoRotateInterval = 5000 
}: RotatingHeroSectionProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
        setIsTransitioning(false);
      }, 500);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [images.length, autoRotateInterval]);

  const goToImage = (index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentImageIndex(index);
      setIsTransitioning(false);
    }, 500);
  };

  return (
    <section className="relative flex min-h-[620px] items-center overflow-hidden text-white">
      {/* Image Container with Rotation */}
      <div className="absolute inset-0">
        {images.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index === 0}
              className="object-cover object-center brightness-[.52]"
              sizes="100vw"
            />
          </div>
        ))}
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy/55 via-navy/15 to-transparent" />

      {/* Content */}
      <div className="shell relative z-10 -translate-y-7 py-20 sm:-translate-y-12">
        <p className="eyebrow">Autumn / Winter 2026</p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[.98] drop-shadow-md sm:text-7xl">
          Modern clothing,<br /><i>rooted in Scotland.</i>
        </h1>
        <p className="mt-6 max-w-md text-base leading-6 text-white">
          Refined everyday pieces, distinctive layers and complete looks inspired by Scottish character.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="button bg-white text-navy hover:bg-highland hover:text-white" href="/shop">
            Shop new arrivals
          </Link>
          <Link className="button border border-white bg-transparent hover:bg-white hover:text-navy" href="/complete-looks">
            Explore looks
          </Link>
        </div>
      </div>
    </section>
  );
}
