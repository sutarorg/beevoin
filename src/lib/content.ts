/**
 * Central marketing & help copy. Every claim here maps to a verified product
 * characteristic or an actual store policy implemented in code.
 */
import { policies, productDefaults } from "./config";

export const HERO = {
  eyebrow: "Beevo Go · Pocket Thermal Printer",
  title: "Print anything from your phone. No ink, ever.",
  subtitle:
    "A palm-size Bluetooth thermal printer for notes, labels, to-do lists, QR codes and little everyday prints. Charges over USB, fits in your pocket, and prints crisp black-and-white in seconds.",
};

export const VALUE_PROPS = [
  {
    icon: "NotebookPen",
    title: "Notes in seconds",
    body: "Type or paste on your phone, tap print, and get a crisp physical note — reminders, formulas, quotes, anything.",
  },
  {
    icon: "Tag",
    title: "Labels & stickers",
    body: "Print tidy labels for jars, files, cables and storage boxes. Label paper rolls make instant peel-and-stick tags.",
  },
  {
    icon: "ListChecks",
    title: "Lists that stay visible",
    body: "Stick today's to-dos on your desk, fridge or laptop. Physical lists are surprisingly hard to ignore.",
  },
  {
    icon: "QrCode",
    title: "QR codes, instantly",
    body: "Generate a QR in the app and print it on the spot — Wi-Fi access, payment links, menus, contact cards.",
  },
  {
    icon: "Image",
    title: "Simple monochrome images",
    body: "Thermally printed black-and-white photos and doodles — charming, retro, and perfect for journals.",
  },
  {
    icon: "FlameKindling",
    title: "Zero ink, zero mess",
    body: "Thermal technology prints with heat, not cartridges. The only consumable you ever buy is paper.",
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Get the companion app",
    body: "Install a compatible mini-printer app on your Android or iOS smartphone from the app store.",
  },
  {
    step: 2,
    title: "Pair over Bluetooth",
    body: "Switch on the Beevo Go and connect it in the app over Bluetooth in a few seconds.",
  },
  {
    step: 3,
    title: "Create your print",
    body: "Type text, make a to-do list, build a QR code or pick a simple image from your gallery.",
  },
  {
    step: 4,
    title: "Tap print",
    body: "Watch it print instantly — completely ink-free, on 57 mm thermal paper.",
  },
] as const;

export const USE_CASES = [
  {
    image: "/images/use-study.jpg",
    alt: "Printed study notes beside the Beevo Go on a student's desk",
    tag: "Students & exam prep",
    title: "Tiny notes that actually stick around",
    body: "Print formulas, definitions, diagrams and mnemonics as pocket strips. Tape them into notebooks or pin them near your desk instead of re-copying by hand.",
  },
  {
    image: "/images/use-labels.jpg",
    alt: "Kitchen jars labelled with strips printed on the Beevo Go",
    tag: "Home organisation",
    title: "A label for every jar, box and cable",
    body: "Kitchen staples, masala boxes, storage bins, chargers — print neat labels on demand and end the guessing game for good.",
  },
  {
    image: "/images/use-journal.jpg",
    alt: "A journal decorated with black-and-white strips printed on the Beevo Go",
    tag: "Journaling & craft",
    title: "Analog-meets-digital creativity",
    body: "Print little monochrome photos, daily quotes, habit trackers and doodle stickers for your planner, scrapbook or pen-pal letters.",
  },
  {
    image: "/images/product-printing.jpg",
    alt: "A printed list strip being pulled out of the Beevo Go",
    tag: "Everyday errands",
    title: "Hand over a list, not your phone",
    body: "Print the kirana list, a medicine schedule for parents, or leaving-day reminders. Paper doesn't need your phone to be read.",
  },
] as const;

export const SPECS: { label: string; value: string; note?: string }[] = [
  { label: "Product type", value: "Portable mini thermal printer" },
  { label: "Printing technology", value: "Direct thermal (ink-free)" },
  { label: "Print resolution", value: "≈ 200 DPI" },
  { label: "Print output", value: "Monochrome (black & white)" },
  { label: "Connectivity", value: "Bluetooth + USB charging" },
  { label: "Compatible with", value: "Android & iOS smartphones via app" },
  { label: "Paper", value: "57 mm thermal paper rolls" },
  { label: "Battery", value: "≈ 1200 mAh rechargeable lithium", note: "approx." },
  { label: "Weight", value: "≈ 160 g", note: "approx." },
  { label: "Body", value: "ABS plastic, pocket-size" },
];

export const IN_THE_BOX = [
  "1 × Beevo Go mini thermal printer",
  "1 × USB charging cable",
  "1 × thermal paper roll (starter roll)",
  "1 × quick-start guide",
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "What exactly is the Beevo Go?",
    a: "It's a pocket-size Bluetooth thermal printer. You pair it with your smartphone, create content in a compatible app, and it prints notes, labels, lists, QR codes and simple images on small rolls of thermal paper — all in black and white.",
  },
  {
    q: "How does thermal printing work?",
    a: "Instead of ink, a thermal print head uses heat to mark special heat-sensitive paper. That's why the printer never needs ink cartridges or toner — the only consumable is paper.",
  },
  {
    q: "Does it need ink or toner?",
    a: "No. Ink-free thermal printing is the whole point — there is nothing to refill. You only replace the 57 mm thermal paper roll when it runs out.",
  },
  {
    q: "How do I connect it to my phone?",
    a: "Charge the printer, turn it on, install a compatible mini-printer app on Android or iOS, and connect to the printer from within the app over Bluetooth. Pairing usually takes a few seconds.",
  },
  {
    q: "Is it compatible with Android?",
    a: "Yes — it works with Android smartphones through compatible mini-printer apps available on the Play Store.",
  },
  {
    q: "Is it compatible with iPhone?",
    a: "Yes — it works with iPhones through compatible mini-printer apps available on the App Store.",
  },
  {
    q: "What can I print?",
    a: "Text notes, to-do lists, labels and stickers, reminders, QR codes, snippets like recipes or addresses, and simple black-and-white images or doodles. It prints on 57 mm-wide paper, so it's best for small-format content.",
  },
  {
    q: "Can I print labels and stickers?",
    a: "Yes. Standard thermal paper works for tags and notes; adhesive/sticker thermal rolls (57 mm) make peel-and-stick labels for jars, files and boxes.",
  },
  {
    q: "Can it print photos?",
    a: "It prints simple black-and-white (monochrome) images at roughly 200 DPI — great for retro-style journal photos and doodles, but it is not a colour photo printer and won't match photo-lab quality.",
  },
  {
    q: "Is it really portable?",
    a: "Yes — it weighs about 160 g, fits in a palm, pocket or bag, and runs on a built-in rechargeable battery (≈1200 mAh), so you can print without a power socket.",
  },
  {
    q: "How do I charge it?",
    a: "With the included USB cable — any regular 5V USB adapter or power bank works. An indicator light shows charging status.",
  },
  {
    q: "What paper does it use?",
    a: "Standard 57 mm-wide thermal paper rolls — the same size used by most mini printers. Plain and adhesive/sticker variants are widely available. A starter roll comes in the box.",
  },
  {
    q: "How long does delivery take?",
    a: `Orders are dispatched within ${policies.dispatchWindow} and usually delivered in ${policies.deliveryEstimate}. You can follow every step on the Track Order page.`,
  },
  {
    q: "What if I have a problem with my order?",
    a: "Write to us from the Contact page with your order ID and we'll sort it out. You can also check live status anytime using Track Order with your order ID and registered mobile number.",
  },
  {
    q: `Is ${productDefaults.shortName} covered by warranty?`,
    a: `We offer a ${policies.replacementWindowDays}-day replacement promise for manufacturing defects. Reach out with your order ID and a short video of the issue and we'll take care of the rest.`,
  },
];

export const SPEC_TICKER = [
  "Ink-free thermal printing",
  "≈ 200 DPI resolution",
  "Bluetooth connectivity",
  "≈ 160 g featherweight",
  "≈ 1200 mAh battery",
  "57 mm paper rolls",
  "Android + iOS compatible",
  "Monochrome output",
] as const;
