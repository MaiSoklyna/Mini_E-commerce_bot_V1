"use client";
import { useRouter } from "next/navigation";
import { MdReceipt } from "react-icons/md";

export default function InvoicesPage() {
  const router = useRouter();

  return (
    <div className="animate-in">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          Invoices
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Order receipts &amp; billing
        </p>
      </div>

      <div className="card text-center py-12">
        <MdReceipt size={52} style={{ margin: "0 auto 16px", display: "block", opacity: 0.25 }} />
        <h2
          className="text-base font-semibold mb-2"
          style={{ color: "var(--text)" }}
        >
          Invoices are generated per order
        </h2>
        <p
          className="text-xs mb-6 mx-auto"
          style={{ color: "var(--text-muted)", maxWidth: 320 }}
        >
          To view or print an invoice, open the order detail from the Orders
          page. Each order includes a full receipt with items, totals, and
          delivery info.
        </p>
        <button
          onClick={() => router.push("/dashboard/orders")}
          className="btn btn-primary"
          style={{ fontSize: 13 }}
        >
          Go to Orders
        </button>
      </div>
    </div>
  );
}
