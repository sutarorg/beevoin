/**
 * The Beevo guide library — the site's topical-authority layer.
 *
 * Why this exists, in SEO terms: a one-page store can only ever rank for
 * transactional queries ("mini printer buy online"). The overwhelming
 * majority of the demand around this product is informational — how thermal
 * printing works, which paper to buy, why prints fade, how to pair over
 * Bluetooth. Covering that cluster properly, with real answers and internal
 * links back to the product, is what lets Google treat the domain as an
 * authority on "mini thermal printers" rather than a single thin listing.
 *
 * Editorial rules for anything added here:
 *   1. Every claim must be verifiable and true of this product / of thermal
 *      printing in general. No invented benchmarks, no fake test data.
 *   2. Lead with the answer (`tldr`), then explain. Answer-first blocks are
 *      what gets lifted into featured snippets and AI Overviews.
 *   3. Headings are phrased as the questions people actually type.
 *   4. No keyword stuffing and no padding — length follows the topic.
 */

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "table"; head: [string, string]; rows: [string, string][] }
  | { type: "note"; text: string };

export type GuideSection = {
  /** Used for the in-page table of contents and jump links. */
  id: string;
  heading: string;
  blocks: GuideBlock[];
};

export type Guide = {
  slug: string;
  title: string;
  /** <title> — kept under ~60 chars so it is not truncated in the SERP. */
  metaTitle: string;
  /** <meta name="description"> — 140-160 chars, written as a click promise. */
  metaDescription: string;
  /** One-line summary used on the hub page and in the Article schema. */
  summary: string;
  published: string;
  updated: string;
  readMinutes: number;
  /** Image used for the card, the hero and the Article schema. */
  image: { src: string; alt: string };
  /** Answer-first summary. Rendered as the "short answer" box. */
  tldr: string[];
  sections: GuideSection[];
  /** Question/answer pairs. FAQPage markup is emitted for these. */
  faqs: { q: string; a: string }[];
  /** Slugs of the related guides shown at the foot of the article. */
  related: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "what-is-a-mini-thermal-printer",
    title: "What is a mini thermal printer, and how does it print without ink?",
    metaTitle: "What Is a Mini Thermal Printer? How Ink-Free Printing Works",
    metaDescription:
      "A plain-English explanation of mini thermal printers: how heat replaces ink, what they can and cannot print, running costs, and who they suit.",
    summary:
      "The physics of ink-free printing, what a 200 DPI thermal head can realistically produce, and the honest limits of the format.",
    published: "2026-03-04",
    updated: "2026-09-22",
    readMinutes: 7,
    image: {
      src: "/images/product-printing.jpg",
      alt: "A Beevo Go mini thermal printer printing a black-and-white photo strip from a phone",
    },
    tldr: [
      "A mini thermal printer has no ink, no toner and no cartridges. A print head heats tiny dots against heat-sensitive paper, and the paper itself darkens where it is heated.",
      "That means the only thing you ever buy again is paper — typically a 57 mm thermal roll.",
      "The trade-off is output: monochrome only, around 200 DPI, on paper about as wide as a receipt. It is superb for notes, labels, lists and QR codes, and it is not a replacement for a photo printer.",
    ],
    sections: [
      {
        id: "how-it-works",
        heading: "How does thermal printing actually work?",
        blocks: [
          {
            type: "p",
            text: "Thermal paper is coated with a colourless dye and a developer held apart in a solid layer. When a point on the paper is heated past a threshold — roughly 90 °C — the layer melts, the two chemicals meet, and that spot turns black. Cool the paper and the reaction stops. There is no ink to transfer, so there is nothing to run out of, dry up or clog.",
          },
          {
            type: "p",
            text: "Inside the printer, a strip of hundreds of microscopic heating elements sits across the paper path. The printer pulses those elements on and off, line by line, while a rubber roller pulls the paper past at a steady speed. A 57 mm printer at roughly 200 DPI lays down about 384 dots across each line — which is why the output is crisp for text and line art, and coarse for photographs.",
          },
          {
            type: "note",
            text: "Because the paper is the consumable, thermal printers are mechanically simple: a heating strip, a motor, a roller and a battery. That simplicity is exactly why they can be palm-sized and why a printer costs less than a set of inkjet cartridges.",
          },
        ],
      },
      {
        id: "what-it-prints",
        heading: "What can you realistically print?",
        blocks: [
          {
            type: "p",
            text: "Think of it as a receipt printer that lives in your pocket. Anything that is small, monochrome and useful on paper works beautifully:",
          },
          {
            type: "list",
            items: [
              "Text notes, reminders, formulas, quotes and passages you want to stop re-reading on a screen.",
              "To-do lists and checklists you can stick on a desk, fridge or laptop lid.",
              "Labels for jars, files, cables and storage boxes — on plain paper, or on adhesive thermal rolls for peel-and-stick tags.",
              "QR codes for Wi-Fi credentials, payment links, menus, event check-ins or contact cards.",
              "Simple black-and-white images: doodles, icons, line drawings, and high-contrast photos rendered in a halftone or dithered style.",
            ],
          },
          {
            type: "h3",
            text: "What it does not do",
          },
          {
            type: "list",
            items: [
              "Colour. Thermal paper darkens in one shade; there is no colour channel to print.",
              "A4 documents. The paper is 57 mm wide — about the width of a shop receipt.",
              "Photo-lab quality. At around 200 DPI in pure monochrome, photos come out grainy and stylised. Many people want exactly that look; just buy it knowingly.",
            ],
          },
        ],
      },
      {
        id: "running-cost",
        heading: "What does it cost to run?",
        blocks: [
          {
            type: "p",
            text: "Paper is the entire running cost. A 57 mm roll is a commodity item sold everywhere thermal receipt rolls are sold, and a pack of rolls costs a fraction of a single inkjet cartridge. Adhesive (sticker) rolls cost more than plain ones, and coloured or pre-printed novelty rolls more again.",
          },
          {
            type: "p",
            text: "There is no cartridge to replace, no print head to prime, and nothing to dry out if you do not print for a month — which is the failure mode that quietly kills most home inkjets.",
          },
        ],
      },
      {
        id: "who-its-for",
        heading: "Who is a mini thermal printer actually for?",
        blocks: [
          {
            type: "table",
            head: ["If you are…", "…this is what you will use it for"],
            rows: [
              ["A student", "Formula strips, definitions, revision checklists and flashcard-sized notes taped into a notebook."],
              ["Organising a home", "Labels for masala jars, storage bins, files, cables and the freezer."],
              ["Running a small business", "Order slips, UPI QR codes, price tags, packing notes and simple parcel labels."],
              ["A journaller or crafter", "Monochrome photos, habit trackers, quote strips and sticker art for planners and scrapbooks."],
              ["Caring for parents or kids", "Medicine schedules, shopping lists and reminders that do not need a phone to read."],
            ],
          },
          {
            type: "p",
            text: "If the thing you want to print is A4, colour, or needs to survive a decade in a filing cabinet, a mini thermal printer is the wrong tool and no amount of marketing changes that.",
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Does a mini thermal printer need ink?",
        a: "No. Thermal printing uses heat against heat-sensitive paper, so there is no ink, toner or cartridge in the machine at all. The only consumable is the paper roll.",
      },
      {
        q: "Can a mini thermal printer print in colour?",
        a: "No. Thermal paper darkens in a single shade, so output is monochrome. Some novelty rolls are pre-tinted or pre-printed with patterns, but the printer itself only produces one colour.",
      },
      {
        q: "Is 200 DPI good enough for text?",
        a: "Yes, comfortably. Around 200 DPI is the same class of resolution used by shop receipt printers, and it renders text, line art, barcodes and QR codes cleanly. It is photographs, not text, that reveal the resolution limit.",
      },
    ],
    related: ["thermal-paper-guide", "connect-mini-printer-to-phone"],
  },

  {
    slug: "mini-thermal-printer-buying-guide-india",
    title: "How to choose a mini thermal printer in India (2026 buying guide)",
    metaTitle: "Mini Thermal Printer Buying Guide India (2026)",
    metaDescription:
      "The seven specifications that actually matter when buying a pocket thermal printer in India — paper width, DPI, battery, app support, warranty and price.",
    summary:
      "The specs worth checking, the marketing claims worth ignoring, and how to avoid the two mistakes that make people abandon a mini printer in a drawer.",
    published: "2026-03-18",
    updated: "2026-09-24",
    readMinutes: 9,
    image: {
      src: "/images/box-contents.jpg",
      alt: "A mini thermal printer with its thermal paper roll, USB charging cable and printed samples laid out",
    },
    tldr: [
      "Check paper width first: 57 mm is the standard, and rolls for it are available everywhere in India. An unusual width locks you into one seller's refills.",
      "Resolution is the second filter — around 200 DPI is the working standard for this class; anything lower shows on text.",
      "The two things buyers regret most are a printer whose app is abandoned, and one that uses a proprietary paper size. Both are avoidable at purchase.",
    ],
    sections: [
      {
        id: "paper-width",
        heading: "1. Paper width: insist on 57 mm",
        blocks: [
          {
            type: "p",
            text: "57 mm is the de-facto standard roll for pocket printers and for the receipt printers used across Indian retail, which means rolls are cheap, available offline as well as online, and available in plain, adhesive and coloured variants. Some printers use 53 mm, 80 mm or a proprietary cassette; every one of those narrows your refill options and raises your running cost.",
          },
          {
            type: "note",
            text: "Before you buy any printer, search for its refill roll separately. If the rolls are only sold by the same brand, treat the printer as a subscription rather than a purchase.",
          },
        ],
      },
      {
        id: "resolution",
        heading: "2. Resolution: about 200 DPI is the working standard",
        blocks: [
          {
            type: "p",
            text: "Pocket thermal printers cluster around 200 DPI (often quoted as 203 DPI, which is 8 dots per millimetre). That is enough for sharp text down to small sizes, for scannable QR codes, and for recognisably rendered images. A 300 DPI head is noticeably better for dense images and costs more; anything below 200 DPI will look ragged on text and should be avoided.",
          },
        ],
      },
      {
        id: "connectivity",
        heading: "3. Connectivity and the app — the thing people underestimate",
        blocks: [
          {
            type: "p",
            text: "The printer is hardware; the experience is software. Almost all mini printers connect over Bluetooth to a companion app, and the quality of that app decides whether you use the device weekly or once. Before buying, check the app on your own phone's store:",
          },
          {
            type: "list",
            items: [
              "Is there a version for both Android and iOS, and has it been updated in the last year?",
              "Do the recent reviews mention it breaking after an OS update?",
              "Does it include the tools you actually want — text, lists, labels, QR codes, image dithering, and printing from the share sheet?",
              "Does it demand an account or excessive permissions for a device that prints text?",
            ],
          },
          {
            type: "p",
            text: "Most printers in this class speak a common ESC/POS-style protocol, so several third-party mini-printer apps will drive them. That is a genuine safety net worth confirming rather than assuming.",
          },
        ],
      },
      {
        id: "battery",
        heading: "4. Battery and charging",
        blocks: [
          {
            type: "p",
            text: "Capacity in this class is typically 1000–1500 mAh, which translates to a long session of intermittent printing rather than continuous roll-feeding — thermal heads draw hard current while printing. What matters more than the headline number:",
          },
          {
            type: "list",
            items: [
              "It should charge over a standard USB cable from any 5 V adapter or power bank; no proprietary dock.",
              "It should be usable while charging, for long label sessions at a desk.",
              "A charge-status indicator saves you from a dead printer at the moment you need it.",
            ],
          },
        ],
      },
      {
        id: "size-build",
        heading: "5. Size, weight and build",
        blocks: [
          {
            type: "p",
            text: "Around 150–200 g and a palm-sized footprint is the sweet spot: light enough to live in a bag, heavy enough to stay put while it feeds paper. Check that the paper compartment opens with a simple latch and takes a whole roll — loading a mini printer should be a two-second operation, not a puzzle.",
          },
        ],
      },
      {
        id: "price-india",
        heading: "6. Price, GST and the COD question in India",
        blocks: [
          {
            type: "p",
            text: "Pocket thermal printers in India generally sit between ₹800 and ₹2,500 depending on resolution, battery and build. Things to verify before paying:",
          },
          {
            type: "list",
            items: [
              "Is the listed price GST-inclusive, and is the final checkout total the same number you were shown?",
              "Is shipping genuinely free, or added at the last step?",
              "If you pay Cash on Delivery, is the COD price different? Many sellers charge more for COD to cover handling — that is legitimate, but it should be disclosed before checkout, not after.",
              "Is a starter paper roll included, or do you need to order rolls with the printer to be able to use it on day one?",
            ],
          },
        ],
      },
      {
        id: "warranty",
        heading: "7. Warranty, returns and who answers the email",
        blocks: [
          {
            type: "p",
            text: "For a device in this price band, a replacement window matters more than a long warranty on paper. Look for a clearly published replacement period for defective or damaged units, a real support address, and an order-tracking page. A seller who publishes their shipping and returns policy in plain language is telling you something useful about what happens when a parcel goes missing.",
          },
        ],
      },
      {
        id: "mistakes",
        heading: "The two mistakes that put printers in drawers",
        blocks: [
          {
            type: "steps",
            items: [
              "Buying for photos. If your mental image is a colour Polaroid, a monochrome 200 DPI thermal printer will disappoint you within a week. Buy it for notes, labels and lists, and treat the retro photo strips as a bonus.",
              "Running out of paper. People buy one starter roll, use it in a fortnight, and never reorder. Buy a multi-pack of 57 mm rolls with the printer — plain plus one adhesive roll — and the habit sticks.",
            ],
          },
        ],
      },
      {
        id: "checklist",
        heading: "The 60-second buying checklist",
        blocks: [
          {
            type: "list",
            items: [
              "57 mm paper width, with refills available from multiple sellers.",
              "Around 200 DPI or better.",
              "Bluetooth, with a maintained app for your phone's OS.",
              "USB charging from a standard cable and adapter.",
              "Starter roll in the box.",
              "Published replacement window, shipping policy and a working support address.",
              "Final price — including COD difference and shipping — visible before you commit.",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "What is a good price for a mini thermal printer in India?",
        a: "Most pocket thermal printers sell between ₹800 and ₹2,500 in India. Below that range, resolution and build quality usually suffer; above it you are generally paying for 300 DPI or a wider 80 mm paper path.",
      },
      {
        q: "Which paper size should a mini printer use?",
        a: "57 mm. It is the standard width for pocket and receipt printers in India, so plain, adhesive and coloured rolls are widely available from many sellers at low cost.",
      },
      {
        q: "Do mini thermal printers work with both Android and iPhone?",
        a: "Most do, through a companion Bluetooth app published for both platforms. Check the app's recent update history and reviews on your own phone's store before buying, because the app is what makes or breaks the experience.",
      },
      {
        q: "Is Cash on Delivery worth it for a mini printer?",
        a: "It is convenient, but many sellers price COD higher than prepaid to cover handling and failed deliveries. Compare both totals before choosing, and only buy where the COD price is shown up front.",
      },
    ],
    related: ["what-is-a-mini-thermal-printer", "thermal-paper-guide"],
  },

  {
    slug: "thermal-paper-guide",
    title: "57 mm thermal paper: types, storage, and why prints fade",
    metaTitle: "57mm Thermal Paper Guide: Types, Storage & Fading",
    metaDescription:
      "Plain, adhesive and coloured 57 mm thermal rolls compared — plus how long thermal prints last, what makes them fade, and how to store them properly.",
    summary:
      "Choosing the right roll, keeping prints legible for years instead of months, and the BPA question answered honestly.",
    published: "2026-04-02",
    updated: "2026-09-20",
    readMinutes: 8,
    image: {
      src: "/images/use-labels.jpg",
      alt: "Printed sticker labels and notes beside a 57 mm thermal paper roll and a mini thermal printer",
    },
    tldr: [
      "Three roll types cover almost everything: plain paper for notes, adhesive (sticker) paper for labels, and coloured or patterned paper for craft.",
      "Thermal prints fade with heat, sunlight, friction and contact with plastics or oils — not with age alone. Stored in a drawer, a print stays legible for years.",
      "If a print must be permanent, photograph it or copy it. Thermal paper is a working medium, not an archival one.",
    ],
    sections: [
      {
        id: "types",
        heading: "Which 57 mm roll should you buy?",
        blocks: [
          {
            type: "table",
            head: ["Roll type", "Best for"],
            rows: [
              ["Plain thermal", "Notes, lists, receipts, reminders. Cheapest per metre and the one to stock in bulk."],
              ["Adhesive / sticker thermal", "Labels for jars, files, cables and boxes. Peel-and-stick; costs more per metre."],
              ["Removable adhesive", "Labels you will reposition — planners, whiteboards, temporary tags."],
              ["Coloured or patterned", "Journaling, scrapbooking and gift tags. The ink is still black; the paper is tinted."],
              ["Transparent / semi-clear", "Overlay stickers for planners and craft. Print contrast is lower."],
            ],
          },
          {
            type: "p",
            text: "Roll diameter matters as much as width: a pocket printer's compartment usually takes a roll up to about 30 mm across. A bulk 57 mm receipt roll bought for a shop counter is often far too fat to fit, so check the diameter, not just the width.",
          },
        ],
      },
      {
        id: "fading",
        heading: "Why do thermal prints fade — and how long do they really last?",
        blocks: [
          {
            type: "p",
            text: "A thermal print is a chemical reaction held in a coating, and the same reaction can be undone or over-triggered. Prints do not fade by simply getting old; they fade because of what touches them:",
          },
          {
            type: "list",
            items: [
              "Heat. A car dashboard, a hot windowsill, or anything above roughly 60 °C will darken the whole sheet grey and destroy legibility.",
              "Sunlight and UV. Direct sun bleaches the image within weeks.",
              "Friction. Rubbing generates local heat; a print loose in a pocket with keys will smudge.",
              "Plasticisers. PVC sleeves, some sticky tapes and soft plastic folders leach chemicals that erase thermal images. Use paper or polypropylene sleeves instead.",
              "Oils, solvents, alcohol and hand sanitiser. Any of these will lift the coating.",
            ],
          },
          {
            type: "p",
            text: "Kept out of sun and heat, in a drawer, a notebook or a paper envelope, a thermal print stays clearly readable for several years. Taped inside a study notebook, a formula strip will comfortably outlast the exam.",
          },
          {
            type: "note",
            text: "Anything that matters — a receipt for a warranty claim, an invoice, a record you may need in five years — should be photographed the day you print it. Treat the paper as the working copy and the photo as the archive.",
          },
        ],
      },
      {
        id: "storage",
        heading: "How to store rolls and prints",
        blocks: [
          {
            type: "steps",
            items: [
              "Keep unused rolls in their wrapper until you load them; the wrapper is also a light barrier.",
              "Store rolls somewhere cool and dry — not on top of a fridge, not in a car, not next to a window.",
              "Keep prints away from PVC. Paper envelopes, polypropylene pockets and plain notebooks are all safe.",
              "If you stick labels on something that gets warm or greasy — a hob-side jar, a tool box — accept that they are annual consumables and reprint them.",
            ],
          },
        ],
      },
      {
        id: "bpa",
        heading: "Is thermal paper safe? The BPA question",
        blocks: [
          {
            type: "p",
            text: "The developer chemical in traditional thermal paper was bisphenol A (BPA), which is why the topic comes up. Manufacturers have been moving to alternatives, and BPA-free rolls — usually using a phenol-free developer — are widely sold and clearly labelled.",
          },
          {
            type: "p",
            text: "Practical guidance: buy rolls explicitly marked BPA-free or phenol-free where you can, especially if the prints will be handled often, by children, or near food. Wash your hands after handling large quantities of any thermal paper, and do not put thermal receipts in paper recycling if your local facility asks you not to.",
          },
        ],
      },
      {
        id: "troubleshooting",
        heading: "Paper problems and their causes",
        blocks: [
          {
            type: "table",
            head: ["Symptom", "Usual cause"],
            rows: [
              ["Blank paper comes out", "The roll is loaded upside down. Only the coated side prints — unroll so the paper feeds off the top, coated side towards the print head."],
              ["Print is faint or patchy", "Low battery, or a dusty print head. Charge fully; wipe the head gently with a cotton bud and isopropyl alcohol, and let it dry."],
              ["Print is very dark and smudged", "Print density set too high in the app, or a warm printer after a long run. Lower the density; let it rest."],
              ["Paper jams or feeds crooked", "Roll diameter too large for the compartment, or the roll edge is crushed. Trim the leading edge square and reseat it."],
              ["Whole strip turns grey later", "Heat exposure. It was left in sunlight, a car or against something warm."],
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "How long do thermal prints last?",
        a: "Kept away from heat, sunlight, friction and plastics, a thermal print stays legible for several years. Exposed to a car dashboard or direct sun it can fade in weeks, so photograph anything you need to keep.",
      },
      {
        q: "Which side of thermal paper prints?",
        a: "Only the coated side reacts to heat. If blank paper comes out, the roll is loaded the wrong way round — flip it so the coated side faces the print head.",
      },
      {
        q: "Can I use any 57 mm roll in a pocket printer?",
        a: "Any 57 mm roll will print, but check the roll diameter too. Pocket printers usually take rolls up to about 30 mm across, so bulk receipt rolls sold for shop counters often will not fit.",
      },
      {
        q: "Is thermal paper BPA-free?",
        a: "Not all of it. BPA-free and phenol-free rolls are widely available and labelled as such; prefer those, particularly for labels that are handled often or used near food.",
      },
    ],
    related: ["what-is-a-mini-thermal-printer", "mini-thermal-printer-buying-guide-india"],
  },

  {
    slug: "connect-mini-printer-to-phone",
    title: "How to connect a mini thermal printer to your phone (and fix it when it won't)",
    metaTitle: "Connect a Mini Thermal Printer to Android or iPhone",
    metaDescription:
      "Step-by-step Bluetooth pairing for a mini thermal printer on Android and iPhone, plus fixes for the printer not showing up, faint prints and failed jobs.",
    summary:
      "Pairing on Android and iOS, why you should not pair from the phone's Bluetooth settings, and a troubleshooting table for every common failure.",
    published: "2026-04-21",
    updated: "2026-09-25",
    readMinutes: 7,
    image: {
      src: "/images/product-3.jpg",
      alt: "Step-by-step setup: selecting a photo on a phone, connecting over Bluetooth, loading paper and printing",
    },
    tldr: [
      "Connect from inside the printer app, not from your phone's Bluetooth settings screen. Most mini printers are never meant to appear as a paired system device.",
      "Order of operations: charge, load paper, switch on, open the app, grant Bluetooth (and on Android, nearby-devices/location) permission, then connect.",
      "If the printer does not appear, the cause is almost always a denied permission, a flat battery, or an existing connection held by another app.",
    ],
    sections: [
      {
        id: "before",
        heading: "Before you start",
        blocks: [
          {
            type: "steps",
            items: [
              "Charge the printer fully over USB. Bluetooth radios and thermal heads are the first things to misbehave on a low battery.",
              "Load a paper roll with the coated side towards the print head and close the latch — most printers refuse to print with the lid open.",
              "Install the companion mini-printer app for your model from the Play Store or App Store.",
              "Switch the printer on and confirm its indicator light shows it is awake and not already connected to something else.",
            ],
          },
        ],
      },
      {
        id: "android",
        heading: "Connecting on Android",
        blocks: [
          {
            type: "steps",
            items: [
              "Turn on Bluetooth in the phone's quick settings.",
              "Open the mini-printer app and allow the permissions it asks for. On Android 12 and later this is 'Nearby devices'; on older versions it is Location, which Bluetooth scanning requires. Denying it makes the printer invisible — this is the single most common failure.",
              "In the app, tap the connect or search icon and wait for the scan to list your printer.",
              "Select the printer. The status indicator in the app should change to connected.",
              "Print a test note before doing anything elaborate.",
            ],
          },
          {
            type: "note",
            text: "Do not pair the printer from Settings → Bluetooth first. Many mini printers use Bluetooth Low Energy and are designed to be claimed by the app directly; a stale system pairing can block the app from seeing the device at all.",
          },
        ],
      },
      {
        id: "iphone",
        heading: "Connecting on iPhone or iPad",
        blocks: [
          {
            type: "steps",
            items: [
              "Turn on Bluetooth in Control Centre or Settings.",
              "Open the mini-printer app and tap Allow when iOS asks for Bluetooth permission. If you dismissed it, enable it under Settings → the app → Bluetooth.",
              "Tap connect inside the app and pick your printer from the list it finds.",
              "Print a test note.",
            ],
          },
          {
            type: "p",
            text: "Mini thermal printers are not AirPrint devices, so they will not appear in the standard iOS print dialogue. Everything goes through the companion app — which is also why that app's quality matters so much.",
          },
        ],
      },
      {
        id: "troubleshooting",
        heading: "Troubleshooting: why it is not printing",
        blocks: [
          {
            type: "table",
            head: ["Problem", "What to do"],
            rows: [
              ["Printer does not appear in the app's list", "Grant Nearby devices (Android 12+) or Location (older Android) / Bluetooth (iOS) permission, then rescan. Confirm the printer is on and not connected to another phone."],
              ["It connects, then drops immediately", "Another app or a previously paired phone is holding the connection. Close other printer apps, turn Bluetooth off and on, and if you paired it in system settings, forget the device there."],
              ["Paper feeds but comes out blank", "The roll is upside down. Reload it so the coated side faces the print head."],
              ["Print is faint or half-missing", "Charge the battery, then raise print density in the app. If it persists, clean the print head with a cotton bud and isopropyl alcohol and let it dry fully."],
              ["Images print as an unreadable black mess", "The image is low-contrast or colourful. Use the app's dithering or black-and-white mode, raise the contrast, and prefer simple line art."],
              ["The job fails halfway", "Usually battery voltage sagging under load, or the phone sleeping mid-transfer. Charge the printer and keep the app in the foreground for long prints."],
              ["Everything looks right and still nothing prints", "Restart the printer, force-close the app, and try a second mini-printer app — most of these printers speak a common protocol, so a second app quickly tells you whether the fault is hardware or software."],
            ],
          },
        ],
      },
      {
        id: "habits",
        heading: "Habits that keep it working",
        blocks: [
          {
            type: "list",
            items: [
              "Top the battery up monthly even if you have not printed; lithium cells dislike being left flat.",
              "Keep the lid closed when it is in a bag so dust stays off the print head.",
              "Keep one spare roll with the printer, not in a cupboard in another room.",
              "Clean the print head every few rolls — it takes ten seconds and is the difference between crisp and patchy output.",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Why is my mini thermal printer not showing up on my phone?",
        a: "In almost every case the app has not been granted Bluetooth scanning permission — Nearby devices on Android 12 and later, Location on older Android, or Bluetooth on iOS. Grant it and rescan. Also check the printer is charged, switched on, and not already connected to another device.",
      },
      {
        q: "Should I pair the printer in my phone's Bluetooth settings?",
        a: "No. Connect from inside the companion app. Many mini printers use Bluetooth Low Energy and are meant to be claimed by the app, and a stale system pairing can stop the app from finding the printer.",
      },
      {
        q: "Does a mini thermal printer work with AirPrint?",
        a: "No. These printers are not AirPrint devices and will not appear in the standard iOS print sheet. Printing is done through the companion Bluetooth app.",
      },
      {
        q: "Why is my printing faint?",
        a: "Most often a low battery, and secondly a dusty print head. Charge the printer fully, raise the print density in the app, and clean the head gently with isopropyl alcohol on a cotton bud.",
      },
    ],
    related: ["thermal-paper-guide", "things-to-print-with-a-mini-printer"],
  },

  {
    slug: "things-to-print-with-a-mini-printer",
    title: "30 genuinely useful things to print with a mini thermal printer",
    metaTitle: "30 Things to Print With a Mini Thermal Printer",
    metaDescription:
      "Practical ideas for a pocket thermal printer — study notes, kitchen labels, QR codes, planner stickers and small-business slips that people actually use.",
    summary:
      "Ideas grouped by who you are, from exam revision strips to UPI QR codes for a shop counter — the uses that survive past the first week.",
    published: "2026-05-12",
    updated: "2026-09-18",
    readMinutes: 6,
    image: {
      src: "/images/use-study.jpg",
      alt: "A desk with printed study notes, revision checklists, labels and journal stickers made on a mini printer",
    },
    tldr: [
      "The uses that last are the ones that replace a screen with paper you leave in view: labels, lists, reminders and codes.",
      "The uses that fade fastest are novelty photos. Print them, enjoy them, but do not buy the printer for them.",
      "Pick three ideas below and print them this week — the habit forms around repetition, not variety.",
    ],
    sections: [
      {
        id: "students",
        heading: "For students and exam prep",
        blocks: [
          {
            type: "list",
            items: [
              "Formula strips taped to the inside cover of a notebook.",
              "Definition and vocabulary cards for spaced-repetition revision.",
              "A revision checklist per subject, ticked off on paper.",
              "Timetables stuck to a desk edge or laptop lid.",
              "Quotes or exam-day reminders on a mirror.",
              "Mnemonics for sequences you keep forgetting.",
              "Reference tables — conversions, dates, irregular verbs.",
              "Page-marker tags for textbooks.",
            ],
          },
        ],
      },
      {
        id: "home",
        heading: "For organising a home",
        blocks: [
          {
            type: "list",
            items: [
              "Jar labels for masalas, pulses and grains — adhesive rolls make these instant.",
              "Freezer labels with the contents and the date frozen.",
              "Cable tags for the drawer of anonymous chargers.",
              "Storage-bin labels so the loft is navigable.",
              "Shopping lists to hand to whoever is going out.",
              "A medicine schedule for a parent, in large clear type.",
              "Plant-care notes stuck to the pot.",
              "Wi-Fi guest credentials, printed once, framed by the door.",
            ],
          },
        ],
      },
      {
        id: "work",
        heading: "For small businesses and side projects",
        blocks: [
          {
            type: "list",
            items: [
              "A UPI QR code at the counter, reprinted whenever it gets scuffed.",
              "Order slips and packing notes for parcels.",
              "Simple price tags for a stall or pop-up.",
              "Thank-you notes tucked into shipped orders.",
              "Batch or date codes for homemade goods.",
              "Appointment reminder slips.",
              "Stock-count sheets for a shelf audit.",
            ],
          },
        ],
      },
      {
        id: "creative",
        heading: "For journaling, planning and craft",
        blocks: [
          {
            type: "list",
            items: [
              "Monochrome photo strips for a scrapbook or bullet journal.",
              "Habit trackers and monthly grids.",
              "Quote and lyric strips as page decoration.",
              "Doodle and icon stickers on adhesive rolls.",
              "Gift tags and parcel labels.",
              "Pen-pal letter inserts and postcard fragments.",
              "Recipe cards sized to clip to a kitchen shelf.",
            ],
          },
        ],
      },
      {
        id: "tips",
        heading: "Small tricks that make the prints better",
        blocks: [
          {
            type: "list",
            items: [
              "For labels, print a blank line above and below the text so there is room to cut without clipping letters.",
              "Bold, larger type reads far better than dense small text on 57 mm paper.",
              "For photos, crop tight and raise the contrast before printing; faces and simple shapes survive dithering, busy scenes do not.",
              "Print QR codes at least 25 mm square so phone cameras lock on immediately.",
              "Keep a pair of small scissors with the printer — a straight cut makes a printed strip look deliberate.",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        q: "Can a mini thermal printer print stickers?",
        a: "Yes, using adhesive 57 mm thermal rolls. They print exactly like plain paper but peel and stick, which makes them ideal for jar labels, planner stickers and cable tags.",
      },
      {
        q: "Can I print QR codes with a mini printer?",
        a: "Yes, and it is one of the best uses for one. Generate the code in the app and print it at least 25 mm square so cameras scan it reliably.",
      },
      {
        q: "Are mini printers good for study notes?",
        a: "They are excellent for it. Formula strips, definitions and revision checklists print in seconds and can be taped straight into a notebook, which is far faster than re-copying them by hand.",
      },
    ],
    related: ["connect-mini-printer-to-phone", "mini-thermal-printer-buying-guide-india"],
  },
];

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Most recently updated guide first — the hub's default ordering. */
export function guidesByFreshness(): Guide[] {
  return [...GUIDES].sort((a, b) => b.updated.localeCompare(a.updated));
}

export function formatGuideDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
