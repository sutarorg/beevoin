import type { Metadata } from "next";
import { TrackClient } from "@/components/track-client";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Check the live status of your Beevo order with your order ID and registered mobile number or email.",
  robots: { index: false, follow: false },
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; key?: string }>;
}) {
  const { order, key } = await searchParams;
  return <TrackClient initialOrder={order ?? ""} initialKey={key ?? ""} />;
}
