"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * A product photo that degrades to a neutral tile instead of a broken-image
 * icon when the file is missing from /public — for example before the shop
 * owner has uploaded their own photography (see public/images/README.md).
 *
 * Always fills its positioned parent, like `next/image` with `fill`.
 */
export function ProductPhoto({
  src,
  alt,
  sizes,
  priority,
  loading,
  compact = false,
  caption = "Photo coming soon",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  /** Small thumbnails hide the caption and use a smaller icon. */
  compact?: boolean;
  caption?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cream text-ink-faint"
        role="img"
        aria-label={alt}
      >
        <ImageOff className={compact ? "size-4" : "size-7"} aria-hidden />
        {!compact ? (
          <span className="px-6 text-center text-[11px] font-bold uppercase tracking-wide">
            {caption}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      loading={loading}
      sizes={sizes}
      className="fade-up object-cover"
      onError={() => setFailed(true)}
    />
  );
}
