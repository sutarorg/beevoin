"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Click-to-play facade for the hero demo video.
 *
 * The YouTube iframe is mounted only after a tap, so no third-party script,
 * cookie or frame loads for the vast majority of visitors who scroll past —
 * LCP and the CSP stay clean. The poster is a first-party image of the
 * printer mid-print, and the whole card keeps the Short's native 9:16 shape.
 */
export function VideoCard({
  youtubeId,
  title,
  poster,
  posterAlt,
  duration,
}: {
  youtubeId: string;
  title: string;
  poster: string;
  posterAlt: string;
  duration: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] border border-sandline bg-ink shadow-pop">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title} (${duration})`}
          className="group absolute inset-0 size-full"
        >
          <Image
            src={poster}
            alt={posterAlt}
            fill
            sizes="(max-width: 768px) 90vw, 360px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={false}
          />
          {/* Legibility scrim behind the play affordance */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-ink/20"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-accent text-white shadow-pop transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
              <Play className="size-6 translate-x-0.5" fill="currentColor" aria-hidden />
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-white/90">
              Live print · no edits
            </span>
            <span className="rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] font-bold text-ink">
              {duration}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
