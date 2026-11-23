"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";
import { usePortalStudent } from "@/lib/portal-student";

type Category = { id: string; name: string };
type Tax = { id: string; name: string; percent: string };
type Product = { id: string; name: string; price: string; stock: number };
type Order = { id: string; soldOn: string; total: string; tax: string; quantity: number };
type Home = { categories: Category[]; taxes: Tax[]; products: Product[]; orders: Order[]; analytics: { orders: number; revenue: string; units: number; lowStock: Array<{ name: string; stock: number }> } };
type Receipt = {
  id: string;
  soldOn: string;
  total: string;
  tax: string;
  lines: Array<{ name: string; quantity: number; unitPrice: string; lineTotal: string }>;
};

export default function StorePage() {
  const { ready, isStudent, error: portalError } = usePortalStudent();
  const [home, setHome] = useState<Home | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const [data, profile] = await Promise.all([api<Home>("/store"), api<{ institute: Institute }>("/institute")]);
    setHome(data);
    setInstitute(profile.institute);
  }

  useEffect(() => {
    if (!ready) return;
    load().catch((err: Error) => setError(err.message));
  }, [ready]);

  async function save(path: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function sell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      const order = await api<Receipt>("/store/orders", {
        method: "POST",
        body: JSON.stringify({ date: data.get("date"), lines: [{ productId: data.get("productId"), quantity: Number(data.get("quantity")) }] }),
      });
      form.reset();
      setReceipt(order);
      setNote(`Sale recorded. ${order.total} posted under Store Income.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the sale");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this order and its statement row?")) return;
    await api(`/store/orders/${id}`, { method: "DELETE" });
    if (receipt?.id === id) setReceipt(null);
    setNote("The order and its income row were removed. Stock was put back.");
    await load();
  }

  if (isStudent) {
    return (
      <PageChrome icon="fa-light fa-cart-shopping" crumbs={[{ label: "Online Store" }]}>
        <div className="print:hidden">
          <StudentPanelHead title="Online Store" hint="Browse school products. Purchases are handled at the school counter." />
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          {home?.products.length ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print catalog
              </button>
            </div>
          ) : null}
        </div>
        {!home?.products.length ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-cart-shopping" /></div>
            <h5>No Products Yet</h5>
            <p>Store items will appear here when the school publishes them.</p>
          </div>
        ) : (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-cart-shopping text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>School store catalog</h2>
                <p>{institute?.name ?? "School"} · {home.products.length} product{home.products.length === 1 ? "" : "s"}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {home.products.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.price}</td>
                    <td>{row.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </PageChrome>
    );
  }

  return (
    <PageChrome icon="fa-light fa-cart-shopping" crumbs={[{ label: "Online Store & POS", href: "/admin/store" }, { label: "Store" }]}>
      <div className="mb-4 grid gap-3 sm:grid-cols-4 print:hidden">
        <div className="esk-panel"><p className="text-sm text-[var(--esk-muted)]">Orders</p><p className="text-xl font-semibold">{home?.analytics.orders ?? "–"}</p></div>
        <div className="esk-panel"><p className="text-sm text-[var(--esk-muted)]">Revenue</p><p className="text-xl font-semibold">{home?.analytics.revenue ?? "–"}</p></div>
        <div className="esk-panel"><p className="text-sm text-[var(--esk-muted)]">Units</p><p className="text-xl font-semibold">{home?.analytics.units ?? "–"}</p></div>
        <div className="esk-panel"><p className="text-sm text-[var(--esk-muted)]">Low stock</p><p className="text-sm font-semibold">{home?.analytics.lowStock.map((item) => `${item.name} ${item.stock}`).join(", ") || "none"}</p></div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px] print:hidden">
        <form className="esk-panel esk-pos-panel" onSubmit={sell}>
          <h2><i className="fa-light fa-cash-register mr-2 text-[var(--esk-purple)]" />POS · New sale</h2>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Record a counter sale. Total posts under Store Income and stock drops.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
            <Field label="Product"><select className={control} name="productId" required defaultValue="">{home?.products.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.price} · stock {row.stock}</option>)}</select></Field>
            <Field label="Quantity"><input className={control} name="quantity" inputMode="numeric" defaultValue={1} required /></Field>
          </div>
          <button className="esk-btn-primary mt-2" type="submit"><i className="fa-light fa-cart-shopping" /> Charge & print slip</button>
        </form>
        {receipt ? (
          <div className="flex flex-col gap-2">
            <button className="esk-btn-primary self-end" type="button" onClick={() => window.print()}>
              <i className="fa-light fa-print" /> Print receipt
            </button>
          </div>
        ) : null}
      </div>

      {receipt ? (
        <article className="esk-receipt thermal mx-auto mb-4 max-w-xs">
          <header className="esk-receipt-head">
            <i className="fa-light fa-receipt text-xl text-[var(--esk-purple)]" />
            <div>
              <h2>Store Receipt</h2>
              <p>{institute?.name ?? "School"} · {receipt.soldOn}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line, index) => (
                <tr key={`${line.name}-${index}`}>
                  <td>{line.name}</td>
                  <td>{line.quantity}</td>
                  <td>{line.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="esk-receipt-totals">
            <div><span>Tax</span><strong>{receipt.tax}</strong></div>
            <div><span>Total</span><strong>{receipt.total}</strong></div>
          </div>
          <p className="mt-3 text-center text-xs text-[var(--esk-muted)]">Thank you · {receipt.id.slice(0, 8)}</p>
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 print:hidden">
        <form className="esk-panel" onSubmit={(event) => save("/store/categories", event)}>
          <h2>Category</h2>
          <Field label="Name"><input className={control} name="name" required /></Field>
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Add category</button>
          <p className="mt-2 text-sm text-[var(--esk-muted)]">{home?.categories.map((row) => row.name).join(", ")}</p>
        </form>
        <form className="esk-panel" onSubmit={(event) => save("/store/taxes", event)}>
          <h2>Tax</h2>
          <Field label="Name"><input className={control} name="name" required /></Field>
          <Field label="Percent"><input className={control} name="percent" inputMode="decimal" required /></Field>
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Add tax</button>
          <p className="mt-2 text-sm text-[var(--esk-muted)]">{home?.taxes.map((row) => `${row.name} ${row.percent}%`).join(", ")}</p>
        </form>
        <form className="esk-panel" onSubmit={(event) => save("/store/products", event)}>
          <h2>Product</h2>
          <Field label="Name"><input className={control} name="name" required /></Field>
          <Field label="Category"><select className={control} name="categoryId" required defaultValue="">{home?.categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Tax"><select className={control} name="taxId" defaultValue=""><option value="">No tax</option>{home?.taxes.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Price"><input className={control} name="price" inputMode="decimal" required /></Field>
          <Field label="Stock"><input className={control} name="stock" inputMode="numeric" required /></Field>
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Add product</button>
          <ul className="mt-2 space-y-1 text-sm text-[var(--esk-muted)]">{home?.products.map((row) => <li key={row.id}>{row.name} · {row.price} · stock {row.stock}</li>)}</ul>
        </form>
      </div>
      {note ? <p className="mt-3 text-sm text-[var(--esk-purple)] print:hidden">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      <div className="print:hidden">
        <DataCard>
          {!home?.orders.length ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-cart-shopping" /></div>
              <h5>No Orders Yet</h5>
              <p>Record a sale to post Store Income.</p>
            </div>
          ) : (
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {home.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.soldOn}</td>
                    <td>{order.quantity}</td>
                    <td>{order.tax}</td>
                    <td>{order.total}</td>
                    <td className="text-right">
                      <button className="text-red-600" type="button" onClick={() => void remove(order.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
      </div>
    </PageChrome>
  );
}
