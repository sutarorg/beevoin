import Link from "next/link";
import { requirePermissionPage } from "@/lib/auth/admin";
import { searchCustomers } from "@/lib/customers";
import { formatDate, formatINR } from "@/lib/format";
import {
  EmptyRow,
  PageHeader,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { adminInput } from "@/components/admin/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermissionPage("customers.view");
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q) || undefined;
  const page = Number((Array.isArray(params.page) ? params.page[0] : params.page) ?? 1) || 1;

  const result = await searchCustomers({ query, page });
  const pages = Math.max(Math.ceil(result.total / result.pageSize), 1);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Built automatically from orders — Beevo has no customer accounts to manage."
      />

      <Panel>
        <form
          method="get"
          className="flex flex-wrap gap-2.5 border-b border-sandline px-5 py-4"
        >
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Name, email or phone"
            aria-label="Search customers"
            className={`${adminInput} max-w-sm flex-1`}
          />
          <button
            type="submit"
            className="min-h-10 rounded-full bg-ink px-5 text-sm font-bold text-paper hover:bg-black"
          >
            Search
          </button>
        </form>

        <TableWrap>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Contact</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Lifetime value</Th>
              <Th>Last order</Th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <EmptyRow colSpan={5}>No customers match that search.</EmptyRow>
            ) : (
              result.rows.map((customer) => (
                <tr key={customer.id} className="hover:bg-cream/50">
                  <Td>
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-extrabold text-ink hover:text-accent-deep"
                    >
                      {customer.name}
                    </Link>
                  </Td>
                  <Td>
                    {customer.email}
                    <span className="block text-[12px] font-semibold text-ink-faint">
                      +91 {customer.phone}
                    </span>
                  </Td>
                  <Td className="text-right">{customer.totalOrders}</Td>
                  <Td className="text-right font-extrabold text-ink">
                    {formatINR(customer.totalSpentInPaise)}
                  </Td>
                  <Td>
                    {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>

        <Pagination
          page={result.page}
          pages={pages}
          total={result.total}
          basePath="/admin/customers"
          params={{ q: query }}
        />
      </Panel>
    </>
  );
}
