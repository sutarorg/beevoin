"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type AccordionItem = { q: string; a: string };

export function Accordion({ items }: { items: readonly AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-sandline/70 overflow-hidden rounded-3xl border border-sandline/80 bg-card shadow-lift">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-button-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4.5 text-left transition-colors hover:bg-cream/50"
              >
                <span className="text-[15px] font-bold text-ink">{item.q}</span>
                <Plus
                  className={cn(
                    "size-4.5 shrink-0 text-accent transition-transform duration-200",
                    isOpen && "rotate-45",
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-button-${i}`}
              hidden={!isOpen}
              className="px-5 pb-5"
            >
              <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
