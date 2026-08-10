import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { HeroSlide } from '../types/api';

interface HeroCarouselProps {
  slides: HeroSlide[];
}

export default function HeroCarousel({ slides }: HeroCarouselProps) {
  const isMultiSlide = slides.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true },
    isMultiSlide ? [Autoplay({ delay: 6000, stopOnInteraction: false })] : []
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="relative overflow-hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => (
            <div key={index} className="min-w-0 flex-[0_0_100%]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-brand-mint leading-tight">
                    {slide.heading}
                  </h1>
                  {slide.subheading && (
                    <p className="mt-4 text-brand-cream/90 max-w-md">{slide.subheading}</p>
                  )}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to="/menu?type=Collection"
                      className="bg-brand-green text-white px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
                    >
                      Order for Collection
                    </Link>
                    <Link
                      to="/menu?type=Delivery"
                      className="bg-brand-orange text-white px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
                    >
                      Order for Delivery
                    </Link>
                  </div>
                  {isMultiSlide && (
                    <div className="mt-8 flex items-center gap-4 text-brand-cream/80">
                      <button
                        type="button"
                        aria-label="Previous banner"
                        onClick={() => emblaApi?.scrollPrev()}
                        className="hover:text-brand-mint transition-colors text-xl leading-none"
                      >
                        &#8249;
                      </button>
                      <span className="text-sm tabular-nums">
                        {String(selectedIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        aria-label="Next banner"
                        onClick={() => emblaApi?.scrollNext()}
                        className="hover:text-brand-mint transition-colors text-xl leading-none"
                      >
                        &#8250;
                      </button>
                    </div>
                  )}
                </div>
                <div className="rounded-lg overflow-hidden aspect-video bg-brand-bg-light">
                  {slide.imageUrl && (
                    <img src={slide.imageUrl} alt={slide.heading} className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
