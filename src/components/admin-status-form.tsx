"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { ORDER_STATUSES, STATUS_META } from "@/lib/order-status";
import { inputClasses } from "./ui";

export function AdminStatusForm({
  orderId,
  currentStatus,
  courierName,
  trackingId,
}: {
  orderId: string;
  currentStatus: string;
  courierName: string;
  trackingId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [courier, setCourier] = useState(courierName);
  const [tracking, setTracking] = useState(trackingId);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          courierName: courier,
          trackingId: tracking,
          note,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage({ ok: false, text: data.error ?? "Update failed." });
        return;
      }
      setMessage({
        ok: true,
        text: "Order updated — the customer has been emailed.",
      });
      setNote("");
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-sandline bg-card p-6 lg:sticky lg:top-8"
    >
      <h2 className="text-[12.5px] font-extrabold uppercase tracking-wider text-ink-faint">
        Update order
      </h2>

      <div className="space-y-1.5">
        <label htmlFor="as-status" className="text-sm font-bold text-ink">
          Order status
        </label>
        <select
          id="as-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={inputClasses(false)}
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="as-courier" className="text-sm font-bold text-ink">
          Courier name <span className="font-semibold text-ink-faint">(optional)</span>
        </label>
        <input
          id="as-courier"
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          placeholder="e.g. Delhivery, BlueDart"
          className={inputClasses(false)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="as-tracking" className="text-sm font-bold text-ink">
          Tracking ID <span className="font-semibold text-ink-faint">(optional)</span>
        </label>
        <input
          id="as-tracking"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Courier tracking number"
          className={inputClasses(false)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="as-note" className="text-sm font-bold text-ink">
          Internal note <span className="font-semibold text-ink-faint">(optional)</span>
        </label>
        <input
          id="as-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Appears in order history"
          maxLength={300}
          className={inputClasses(false)}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-[15px] font-bold text-paper transition hover:bg-black disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-4.5 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4.5" aria-hidden />
        )}
        Save & notify customer
      </button>

      {message ? (
        <p
          role="status"
          className={
            message.ok
              ? "rounded-xl bg-leaf-soft p-3 text-[13px] font-bold text-leaf"
              : "rounded-xl bg-chili-soft p-3 text-[13px] font-bold text-chili"
          }
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
