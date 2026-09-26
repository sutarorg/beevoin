"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type GalleryImage = { src: string; alt: string };

/**
 * `compactOnMobile` shortens the mobile aspect ratio so headline, price and
 * the purchase action fit into more of the first mobile viewport instead of
 * being pushed below the fold by a full square image. Desktop stays square.
 */
export function ProductGallery({
  images,
  compactOnMobile = false,
}: {
  images: readonly GalleryImage[];
  compactOnMobile?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + images.length) % images.length);
    },
    [images.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (zoomOpen && !dialog.open) dialog.showModal();
    if (!zoomOpen && dialog.open) dialog.close();
  }, [zoomOpen]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 42) go(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const current = images[index];

  return (
    <div className="min-w-0 space-y-3">
      <div
        className={cn(
          "group relative overflow-hidden rounded-3xl border border-sandline bg-white",
          compactOnMobile ? "aspect-[4/3] sm:aspect-square" : "aspect-square",
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          priority={index === 0}
          sizes="(max-width: 768px) 100vw, 560px"
          className="fade-up object-cover"
        />
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-xs font-bold text-ink shadow-lift backdrop-blur transition hover:bg-white"
          aria-label={`View larger image: ${current.alt}`}
        >
          <Expand className="size-3.5" aria-hidden />
        </button>
        <div className="absolute inset-y-0 left-0 hidden items-center pl-3 sm:flex">
          <button
            type="button"
            onClick={() => go(-1)}
            className="rounded-full bg-white/90 p-2.5 text-ink opacity-0 shadow-lift backdrop-blur transition group-hover:opacity-100 hover:bg-white"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 hidden items-center pr-3 sm:flex">
          <button
            type="button"
            onClick={() => go(1)}
            className="rounded-full bg-white/90 p-2.5 text-ink opacity-0 shadow-lift backdrop-blur transition group-hover:opacity-100 hover:bg-white"
            aria-label="Next image"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        {/* position dots for mobile */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
          {images.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-ink" : "w-1.5 bg-ink/25",
              )}
            />
          ))}
        </div>
      </div>

      {/* Thumbnails — horizontal swipe strip, scrollbar hidden */}
      <div
        className="no-scrollbar flex min-w-0 gap-2.5 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Product images"
      >
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Image ${i + 1}: ${img.alt}`}
            onClick={() => setIndex(i)}
            className={cn(
              "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition sm:size-[4.5rem]",
              i === index
                ? "border-accent"
                : "border-sandline hover:border-ink-faint",
            )}
          >
            <Image
              src={img.src}
              alt=""
              fill
              sizes="72px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {/* Full-screen viewer */}
      <dialog
        ref={dialogRef}
        onClose={() => setZoomOpen(false)}
        aria-label="Product image viewer"
        className="m-auto h-full w-full max-w-none bg-transparent p-4"
      >
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-4">
          <div className="relative aspect-square w-full max-w-140 overflow-hidden rounded-2xl bg-white">
            <Image
              src={current.src}
              alt={current.alt}
              fill
              sizes="(max-width: 768px) 100vw, 560px"
              className="object-cover"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-ink"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <span className="text-sm font-bold text-white">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-ink"
              aria-label="Next image"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink"
            >
              <X className="size-4" aria-hidden />
              Close
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
