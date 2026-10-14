"use client";

import { useState } from "react";
import { type Supplier } from "../data";
import { ghs } from "../pricing";
import { ingredientOf, lowStock, staffById, useDemo, type PurchaseOrder } from "../store";
import { Caps, dateOf, Field, Figure, inputCls, K, Modal, Money, Num, PageHead, Pill, qty3, Rows, Select, Tab, TextLink, whenOf } from "../ui";

const poTotal = (po: PurchaseOrder) => Math.round(po.items.reduce((n, i) => n + i.qty * i.unitCost, 0) * 100);
const poReceivedTotal = (po: PurchaseOrder) => Math.round(po.items.reduce((n, i) => n + (i.received ?? 0) * i.unitCost, 0) * 100);

export function Purchasing() {
  const { state, now } = useDemo();
  const [tab, setTab] = useState<"orders" | "suppliers">("orders");
  const [receiving, setReceiving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const open = state.purchaseOrders.filter((p) => p.status === "ordered");
  const outstanding = open.reduce((n, p) => n + poTotal(p), 0);
  const month = state.purchaseOrders.filter((p) => p.status === "received").reduce((n, p) => n + poReceivedTotal(p), 0);
  const low = lowStock(state);
  const list = [...state.purchaseOrders].sort((a, b) => b.at - a.at);

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Purchasing" title="Orders & deliveries." lede="Raise a purchase order from the low-stock list, then receive it against the supplier’s invoice when the van arrives. Received goods land in stock the moment you confirm.">
        <TextLink tone="fg2" onClick={() => setAddingSupplier(true)}>
          New supplier
        </TextLink>
        <TextLink onClick={() => setCreating(true)}>New purchase order</TextLink>
      </PageHead>

      <dl className={`mt-10 grid gap-8 border-y py-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-(--line) ${K.line}`}>
        <Figure label="Awaiting delivery" sub={open.length ? open.map((p) => `${p.number} · ${state.suppliers.find((s) => s.id === p.supplierId)?.name.split(" ")[0]}`).join(" · ") : "nothing on order"} warn={open.length > 0}>
          <Money cents={outstanding} size="lg" />
        </Figure>
        <Figure label="Received this period" className="sm:pl-8" sub="goods receipt notes, valued at PO cost">
          <Money cents={month} size="lg" />
        </Figure>
        <Figure label="Below minimum" className="sm:pl-8" sub={low.length ? "suggested in a new order" : "stock levels healthy"} warn={low.length > 0}>
          <Num className={`text-[52px] leading-none tracking-[-.03em] ${low.length ? K.warn : K.fg}`}>{low.length}</Num>
        </Figure>
      </dl>

      <div className="mt-10 flex gap-7">
        <Tab name="purch" on={tab === "orders"} onClick={() => setTab("orders")}>
          Purchase orders · {state.purchaseOrders.length}
        </Tab>
        <Tab name="purch" on={tab === "suppliers"} onClick={() => setTab("suppliers")}>
          Suppliers · {state.suppliers.length}
        </Tab>
      </div>

      {tab === "orders" && (
        <div className="mt-6">
          <Rows head={["PO", "Supplier", "Lines", "Raised", "Expected", "Status", "Value"]}>
            {list.map((po) => {
              const sup = state.suppliers.find((s) => s.id === po.supplierId);
              const late = po.status === "ordered" && now > po.expectedAt;
              return (
                <tr key={po.id}>
                  <td className="py-3 pr-4 font-serif text-[17px] lining">{po.number}</td>
                  <td className={`py-3 pr-4 ${K.fg2}`}>
                    {sup?.name}
                    <span className={`block text-xs ${K.fg3}`}>{sup?.terms}</span>
                  </td>
                  <td className={`max-w-[280px] truncate py-3 pr-4 text-xs ${K.fg3}`}>{po.items.map((i) => `${qty3(i.qty)} ${ingredientOf(state, i.ingredientId)?.unit} ${ingredientOf(state, i.ingredientId)?.name.split(" (")[0]}`).join(", ")}</td>
                  <td className={`py-3 pr-4 text-xs ${K.fg3}`}>
                    {whenOf(po.at, now)} · {staffById(state, po.byId)?.name.split(" ")[0]}
                  </td>
                  <td className={`py-3 pr-4 text-xs ${late ? K.warn : K.fg3}`}>{po.status === "received" ? `received ${whenOf(po.receivedAt!, now)}` : `${dateOf(po.expectedAt)}${late ? " · overdue" : ""}`}</td>
                  <td className="py-3 pr-4">
                    {po.status === "ordered" ? (
                      <TextLink onClick={() => setReceiving(po.id)}>Receive goods</TextLink>
                    ) : (
                      <span className={`text-[11px] font-semibold uppercase tracking-[.16em] ${K.fg3}`}>
                        GRN · inv {po.invoice}
                        {poReceivedTotal(po) !== poTotal(po) ? " · short" : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Num className="text-[16px]">{ghs(po.status === "received" ? poReceivedTotal(po) : poTotal(po))}</Num>
                  </td>
                </tr>
              );
            })}
          </Rows>
        </div>
      )}

      {tab === "suppliers" && (
        <div className="mt-6">
          <Rows head={["Supplier", "Contact", "Terms", "Lead time", "Supplies", "Open POs", "Spend"]}>
            {state.suppliers.map((s) => {
              const pos = state.purchaseOrders.filter((p) => p.supplierId === s.id);
              return (
                <tr key={s.id}>
                  <td className="py-3 pr-4 font-serif text-[17px]">{s.name}</td>
                  <td className={`py-3 pr-4 ${K.fg2}`}>
                    {s.contact}
                    <span className={`block text-xs ${K.fg3}`}>{s.phone}</span>
                  </td>
                  <td className={`py-3 pr-4 text-xs ${K.fg3}`}>{s.terms}</td>
                  <td className={`py-3 pr-4 ${K.fg2}`}>
                    <Num>{s.leadDays}</Num> <span className={`text-xs ${K.fg3}`}>day{s.leadDays === 1 ? "" : "s"}</span>
                  </td>
                  <td className={`max-w-[240px] truncate py-3 pr-4 text-xs ${K.fg3}`}>{state.ingredients.filter((i) => i.supplierId === s.id).map((i) => i.name.split(" (")[0]).join(", ") || "—"}</td>
                  <td className={`py-3 pr-4 ${K.fg2}`}>
                    <Num>{pos.filter((p) => p.status === "ordered").length}</Num>
                  </td>
                  <td className="py-3 text-right">
                    <Num className="text-[16px]">{ghs(pos.reduce((n, p) => n + (p.status === "received" ? poReceivedTotal(p) : 0), 0))}</Num>
                  </td>
                </tr>
              );
            })}
          </Rows>
        </div>
      )}

      <ReceiveModal poId={receiving} onClose={() => setReceiving(null)} />
      <NewPoModal open={creating} onClose={() => setCreating(false)} />
      <NewSupplier open={addingSupplier} onClose={() => setAddingSupplier(false)} />
    </div>
  );
}

function ReceiveModal({ poId, onClose }: { poId: string | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const po = state.purchaseOrders.find((p) => p.id === poId);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [invoice, setInvoice] = useState("");
  const sup = po ? state.suppliers.find((s) => s.id === po.supplierId) : undefined;
  const received = po ? po.items.map((i) => ({ ingredientId: i.ingredientId, qty: qty[i.ingredientId] === undefined || qty[i.ingredientId] === "" ? i.qty : Number(qty[i.ingredientId]) || 0 })) : [];
  const value = po ? Math.round(received.reduce((n, r) => n + r.qty * (po.items.find((i) => i.ingredientId === r.ingredientId)?.unitCost ?? 0), 0) * 100) : 0;
  const ok = Boolean(po && invoice.trim().length >= 3 && received.some((r) => r.qty > 0));
  return (
    <Modal open={Boolean(po)} onClose={onClose} kicker={po ? `${po.number} · ${sup?.name} · raised ${dateOf(po.at)}` : undefined} title="Receive goods" width="max-w-xl">
      {po && (
        <div className="space-y-7">
          <p className={`text-sm ${K.fg2}`}>Verify what came off the van. Leave a quantity blank to accept the ordered amount; type a smaller number for a short delivery.</p>
          <table className="w-full text-sm">
            <thead className={`text-left text-[11px] font-semibold uppercase tracking-[.18em] ${K.fg3}`}>
              <tr className={`border-b ${K.line}`}>
                <th className="py-2 pr-4 font-semibold">Ingredient</th>
                <th className="py-2 pr-4 font-semibold">Ordered</th>
                <th className="py-2 pr-4 font-semibold">Received</th>
                <th className="py-2 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line2)">
              {po.items.map((i) => {
                const ing = ingredientOf(state, i.ingredientId);
                const r = received.find((x) => x.ingredientId === i.ingredientId)!;
                return (
                  <tr key={i.ingredientId}>
                    <td className="py-2 pr-4">
                      {ing?.name}
                      <span className={`block text-xs ${K.fg3}`}>
                        {ghs(Math.round(i.unitCost * 100))} / {ing?.unit} · now {qty3(ing?.stock ?? 0)} {ing?.unit}
                      </span>
                    </td>
                    <td className={`py-2 pr-4 ${K.fg2}`}>
                      <Num>{qty3(i.qty)}</Num> <span className={`text-xs ${K.fg3}`}>{ing?.unit}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <input inputMode="decimal" value={qty[i.ingredientId] ?? ""} onChange={(e) => setQty({ ...qty, [i.ingredientId]: e.target.value })} placeholder={qty3(i.qty)} className={`${inputCls} w-24 py-1 font-serif text-[18px] lining`} />
                      {r.qty < i.qty && <span className={`ml-2 text-[11px] font-semibold uppercase tracking-[.14em] ${K.warn}`}>short</span>}
                    </td>
                    <td className="py-2 text-right">
                      <Num>{ghs(Math.round(r.qty * i.unitCost * 100))}</Num>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="grid grid-cols-[1fr_auto] items-end gap-8">
            <Field label="Supplier invoice number" hint="Matched against the PO for the accountant.">
              <input autoFocus value={invoice} onChange={(e) => setInvoice(e.target.value.slice(0, 24))} placeholder={`${sup?.name.slice(0, 2).toUpperCase()}-${Math.floor(10000 + ((po.at / 1000) % 80000))}`} className={`${inputCls} font-serif text-[22px] lining`} />
            </Field>
            <div className="text-right">
              <Caps>Goods value</Caps>
              <div className="mt-1">
                <Money cents={value} size="md" />
              </div>
            </div>
          </div>
          <Pill
            tone="accent"
            disabled={!ok}
            right={ok ? "adds to stock now" : undefined}
            onClick={() => {
              dispatch({ type: "poReceive", poId: po.id, received, invoice: invoice.trim() });
              setQty({});
              setInvoice("");
              onClose();
            }}
          >
            Confirm goods received
          </Pill>
        </div>
      )}
    </Modal>
  );
}

function NewPoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Record<string, string>>({});
  const sup = state.suppliers.find((s) => s.id === supplierId) ?? null;
  const candidates = state.ingredients.filter((i) => !sup || i.supplierId === sup.id);
  const low = lowStock(state);
  const chosen = candidates
    .map((i) => ({ i, qty: Number(lines[i.id]) || 0 }))
    .filter((x) => x.qty > 0);
  const total = Math.round(chosen.reduce((n, x) => n + x.qty * x.i.cost, 0) * 100);
  const suggest = () => {
    const next: Record<string, string> = {};
    low.filter((i) => !sup || i.supplierId === sup.id).forEach((i) => (next[i.id] = qty3(Math.max(i.min * 2 - i.stock, i.min))));
    setLines(next);
  };
  return (
    <Modal open={open} onClose={onClose} kicker="Purchasing" title="New purchase order" width="max-w-xl">
      <div className="space-y-7">
        <div className="grid grid-cols-[1fr_auto] items-end gap-8">
          <Field label="Supplier" hint={sup ? `${sup.contact} · ${sup.phone} · ${sup.terms} · ${sup.leadDays}-day lead time` : "Pick a supplier to see what they stock."}>
            <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setLines({}); }}>
              <option value="">Choose…</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <TextLink tone="fg2" onClick={suggest} disabled={!low.filter((i) => !sup || i.supplierId === sup.id).length}>
            Fill from low stock
          </TextLink>
        </div>
        {sup && (
          <table className="w-full text-sm">
            <thead className={`text-left text-[11px] font-semibold uppercase tracking-[.18em] ${K.fg3}`}>
              <tr className={`border-b ${K.line}`}>
                <th className="py-2 pr-4 font-semibold">Ingredient</th>
                <th className="py-2 pr-4 font-semibold">On hand</th>
                <th className="py-2 pr-4 font-semibold">Order</th>
                <th className="py-2 text-right font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line2)">
              {candidates.map((i) => {
                const q = Number(lines[i.id]) || 0;
                return (
                  <tr key={i.id}>
                    <td className="py-2 pr-4">
                      {i.name}
                      <span className={`block text-xs ${K.fg3}`}>
                        {ghs(Math.round(i.cost * 100))} / {i.unit}
                      </span>
                    </td>
                    <td className={`py-2 pr-4 ${i.stock <= i.min ? K.warn : K.fg2}`}>
                      <Num>{qty3(i.stock)}</Num> <span className={`text-xs ${K.fg3}`}>/ min {qty3(i.min)}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="flex items-baseline gap-2">
                        <input inputMode="decimal" value={lines[i.id] ?? ""} onChange={(e) => setLines({ ...lines, [i.id]: e.target.value })} placeholder="0" className={`${inputCls} w-20 py-1 font-serif text-[18px] lining`} />
                        <span className={`text-xs ${K.fg3}`}>{i.unit}</span>
                      </span>
                    </td>
                    <td className={`py-2 text-right ${q ? "" : K.fg3}`}>
                      <Num>{q ? ghs(Math.round(q * i.cost * 100)) : "—"}</Num>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="flex items-end justify-between">
          <div>
            <Caps>
              {chosen.length} line{chosen.length === 1 ? "" : "s"}
              {sup ? ` · expected in ${sup.leadDays} day${sup.leadDays === 1 ? "" : "s"}` : ""}
            </Caps>
            <div className="mt-1">
              <Money cents={total} size="md" />
            </div>
          </div>
          <Pill
            tone="accent"
            size="md"
            className="!w-auto"
            disabled={!sup || !chosen.length}
            onClick={() => {
              dispatch({ type: "poCreate", supplierId: sup!.id, items: chosen.map((x) => ({ ingredientId: x.i.id, qty: x.qty, unitCost: x.i.cost })), expectedDays: sup!.leadDays });
              setLines({});
              setSupplierId("");
              onClose();
            }}
          >
            Raise order
          </Pill>
        </div>
      </div>
    </Modal>
  );
}

function NewSupplier({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState("Cash on delivery");
  const [lead, setLead] = useState("1");
  const ok = name.trim().length >= 2 && contact.trim().length >= 2;
  return (
    <Modal open={open} onClose={onClose} kicker="Purchasing" title="New supplier">
      <div className="space-y-7">
        <Field label="Business">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Kaneshie Spice Traders" className={`${inputCls} font-serif text-[22px]`} />
        </Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Contact">
            <input value={contact} onChange={(e) => setContact(e.target.value.slice(0, 40))} placeholder="Sister Akos" className={inputCls} />
          </Field>
          <Field label="Phone">
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 16))} placeholder="024 000 0000" className={`${inputCls} lining`} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Terms">
            <Select value={terms} onChange={(e) => setTerms(e.target.value)}>
              {["Cash on delivery", "Net 7", "Net 14", "Net 30"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Lead time (days)">
            <input inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value.replace(/\D/g, "").slice(0, 2))} className={`${inputCls} font-serif text-[22px] lining`} />
          </Field>
        </div>
        <Pill
          tone="accent"
          disabled={!ok}
          onClick={() => {
            const supplier: Supplier = { id: `s${Date.now().toString(36)}`, name: name.trim(), contact: contact.trim(), phone: phone.trim() || "—", terms, leadDays: Number(lead) || 1 };
            dispatch({ type: "supplierAdd", supplier });
            setName("");
            setContact("");
            setPhone("");
            onClose();
          }}
        >
          Add supplier
        </Pill>
      </div>
    </Modal>
  );
}
