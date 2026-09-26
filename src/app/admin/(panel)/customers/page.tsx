import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/admin";
import { listCustomers } from "@/lib/admin/queries";
import { formatDateTime, formatINR } from "@/lib/format";
import { FilterBar } from "@/components/admin/filters";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Customers" };

/**
 * Customers.
 *
 * Derived entirely from real orders — Beevo has no customer accounts and no
 * marketing list. Totals are maintained transactionally as orders are paid
 * and refunded.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("customers.view");
  const params = await searchParams;

  const result = await listCustomers({ q: params.q, page: params.page });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Built from real orders. There are no customer logins and no marketing list — this is an operational record only."
      />

      <Panel>
        <FilterBar
          action="/admin/customers"
          placeholder="Name, email or phone"
          q={params.q}
        />

        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Contact</Th>
              <Th>Orders</Th>
              <Th>Net spend</Th>
              <Th>First order</Th>
              <Th>Last order</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={6}>No customers yet.</EmptyRow>
            ) : (
              result.rows.map((customer) => (
                <tr key={customer.id} className="hover:bg-cream/50">
                  <Td>
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-bold text-ink hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-soft">
                    {customer.email}
                    <span className="block text-[12.5px]">
                      +91 {customer.phone}
                    </span>
                  </Td>
                  <Td className="font-mono tabular-nums">
                    {customer.totalOrders}
                  </Td>
                  <Td className="font-mono font-bold tabular-nums">
                    {formatINR(customer.totalSpentInPaise)}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {customer.firstOrderAt
                      ? formatDateTime(customer.firstOrderAt)
                      : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-soft">
                    {customer.lastOrderAt
                      ? formatDateTime(customer.lastOrderAt)
                      : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          basePath="/admin/customers"
          params={params}
        />
      </Panel>
    </>
  );
}
