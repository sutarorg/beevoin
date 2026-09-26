import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/lib/auth/admin";
import { findCustomerById } from "@/lib/customers";
import { ordersForCustomer } from "@/lib/orders";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import {
  DefinitionList,
  EmptyRow,
  PageHeader,
  Panel,
  Pill,
  StatusPill,
  TableWrap,
  Td,
  Th,
  paymentTone,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await findCustomerById(id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionPage("customers.view");
  const { id } = await params;

  const customer = await findCustomerById(id);
  if (!customer) notFound();

  const orders = await ordersForCustomer(customer.id);

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={`Customer since ${formatDate(customer.createdAt)}`}
        action={
          <Link
            href="/admin/customers"
            className="text-[13px] font-bold text-accent-deep hover:underline"
          >
            ← All customers
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <Panel title="Profile">
          <DefinitionList
            items={[
              { label: "Email", value: customer.email },
              { label: "Phone", value: customer.phone ? `+91 ${customer.phone}` : "—" },
              { label: "Orders", value: customer.totalOrders },
              {
                label: "Lifetime value",
                value: formatINR(customer.totalSpentInPaise),
              },
              {
                label: "First order",
                value: customer.firstOrderAt
                  ? formatDate(customer.firstOrderAt)
                  : "—",
              },
              {
                label: "Last order",
                value: customer.lastOrderAt
                  ? formatDate(customer.lastOrderAt)
                  : "—",
              },
            ]}
          />
        </Panel>

        <Panel title="Order history">
          <TableWrap>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <EmptyRow colSpan={5}>No orders linked yet.</EmptyRow>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-cream/50">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-extrabold text-ink hover:text-accent-deep"
                      >
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>{formatDateTime(order.createdAt)}</Td>
                    <Td>
                      <Pill tone={paymentTone(order.paymentStatus)}>
                        {order.paymentMethod === "cod" ? "COD" : "Online"}
                      </Pill>
                    </Td>
                    <Td>
                      <StatusPill status={order.status} />
                    </Td>
                    <Td className="text-right font-extrabold text-ink">
                      {formatINR(order.totalInPaise)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}
