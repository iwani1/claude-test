"use client";

import { useState } from "react";
import { ROLE_ORDER, ROLES, type Perm, type Role, type Staff as StaffT } from "../data";
import { ghs } from "../pricing";
import { currentUser, useDemo } from "../store";
import { Caps, Field, inputCls, K, Modal, Num, PageHead, Pill, Rows, Select, Switch, TextLink, whenOf } from "../ui";

const PERMS: { id: Perm; label: string }[] = [
  { id: "pos", label: "Till" },
  { id: "kds", label: "Kitchen" },
  { id: "orders", label: "Orders" },
  { id: "drawer", label: "Drawer" },
  { id: "refund", label: "Approve refunds" },
  { id: "reports", label: "Reports" },
  { id: "menu", label: "Menu & recipes" },
  { id: "stock", label: "Stock & purchasing" },
  { id: "staff", label: "Staff" },
  { id: "settings", label: "Settings & hardware" },
  { id: "audit", label: "Audit log" },
];

export function Staff() {
  const { state, dispatch, now } = useDemo();
  const me = currentUser(state);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const takings = (id: string) => state.orders.filter((o) => o.payment?.byId === id).reduce((n, o) => n + o.payment!.amountCents, 0);
  const active = state.staff.filter((u) => u.active).length;

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Staff & permissions" title="The team." lede={`${active} active of ${state.staff.length} · six roles, one PIN each. What a role can see is fixed in the permission matrix below; nobody is granted anything one-off.`}>
        <TextLink onClick={() => setAdding(true)}>Add a team member</TextLink>
      </PageHead>

      <div className="mt-10">
        <Rows head={["Name", "Role", "Terminal", "Last sign-in", "Phone", "Active", "Takings · shift"]}>
          {state.staff.map((u) => (
            <tr key={u.id} className={u.active ? "" : "opacity-50"}>
              <td className="py-3 pr-4">
                <button type="button" onClick={() => setEditing(u.id)} className="text-left hover:text-(--accent)">
                  <span className="block font-serif text-[17px]">
                    {u.name}
                    {u.id === me?.id && <span className={`ml-2 text-[11px] font-semibold uppercase tracking-[.14em] ${K.accent}`}>you</span>}
                  </span>
                  <span className={`block text-xs ${K.fg3}`}>{u.email}</span>
                </button>
              </td>
              <td className={`py-3 pr-4 ${K.fg2}`}>
                {ROLES[u.role].label}
                <span className={`block text-xs ${K.fg3}`}>{ROLES[u.role].can.length} permissions</span>
              </td>
              <td className={`py-3 pr-4 text-xs ${K.fg3}`}>{ROLES[u.role].terminal ? `PIN · ${u.pin.replace(/./g, "•")}` : "no terminal access"}</td>
              <td className={`py-3 pr-4 text-xs ${K.fg3}`}>{u.lastLogin ? whenOf(u.lastLogin, now) : "never"}</td>
              <td className={`py-3 pr-4 text-xs lining ${K.fg3}`}>{u.phone}</td>
              <td className="py-3 pr-4">
                <Switch on={u.active} disabled={u.id === me?.id || u.role === "owner"} onChange={(v) => dispatch({ type: "staffUpdate", id: u.id, patch: { active: v } })} />
              </td>
              <td className="py-3 text-right">
                <Num className="text-[16px]">{takings(u.id) ? ghs(takings(u.id)) : "—"}</Num>
              </td>
            </tr>
          ))}
        </Rows>
      </div>

      <section className="mt-14">
        <Caps>Permission matrix</Caps>
        <p className={`mt-2 max-w-[60ch] text-sm leading-relaxed ${K.fg2}`}>The same matrix the real terminal enforces server-side. Cooks have no terminal login at all — the kitchen display is opened by a cashier or manager.</p>
        <div className="mt-6 overflow-x-auto no-bar">
          <table className="w-full min-w-[720px] text-sm">
            <thead className={`text-left text-[11px] font-semibold uppercase tracking-[.18em] ${K.fg3}`}>
              <tr className={`border-b ${K.line}`}>
                <th className="py-2 pr-4 font-semibold">Permission</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="py-2 pr-4 text-center font-semibold">
                    {ROLES[r].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line2)">
              {PERMS.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-4">{p.label}</td>
                  {ROLE_ORDER.map((r) => {
                    const yes = ROLES[r].can.includes(p.id);
                    return (
                      <td key={r} className="py-2.5 pr-4 text-center">
                        <span className={`inline-block h-2 w-2 rounded-full ${yes ? "bg-(--accent)" : "bg-(--line)"}`} aria-label={yes ? "allowed" : "not allowed"} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EditStaff id={editing} onClose={() => setEditing(null)} />
      <AddStaff open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function EditStaff({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const u = state.staff.find((x) => x.id === id);
  const me = currentUser(state);
  return (
    <Modal open={Boolean(u)} onClose={onClose} kicker={u ? ROLES[u.role].label : undefined} title={u?.name ?? ""}>
      {u && <StaffForm key={u.id} initial={u} lockRole={u.role === "owner" || u.id === me?.id} onSave={(patch) => dispatch({ type: "staffUpdate", id: u.id, patch })} onClose={onClose} />}
    </Modal>
  );
}

function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  return (
    <Modal open={open} onClose={onClose} kicker="Staff & permissions" title="New team member">
      <StaffForm
        initial={{ id: "", name: "", role: "cashier", pin: "", phone: "", email: "", active: true }}
        isNew
        onSave={(patch) => {
          const name = (patch.name ?? "").trim();
          dispatch({ type: "staffAdd", staff: { id: `u${Date.now().toString(36)}`, name, role: patch.role ?? "cashier", pin: patch.pin ?? "", phone: patch.phone ?? "", email: patch.email || `${name.split(" ")[0].toLowerCase()}@lushview.gh`, active: true } });
        }}
        onClose={onClose}
      />
    </Modal>
  );
}

function StaffForm({ initial, isNew = false, lockRole = false, onSave, onClose }: { initial: StaffT; isNew?: boolean; lockRole?: boolean; onSave: (patch: Partial<StaffT>) => void; onClose: () => void }) {
  const { state } = useDemo();
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState<Role>(initial.role);
  const [pin, setPin] = useState(isNew ? "" : initial.pin);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const terminal = ROLES[role].terminal;
  const pinTaken = terminal && pin.length === 4 && state.staff.some((u) => u.id !== initial.id && u.pin === pin);
  const ok = name.trim().length >= 3 && (!terminal || (pin.length === 4 && !pinTaken));
  return (
    <div className="space-y-7">
      <Field label="Full name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Akosua Mensah" className={`${inputCls} font-serif text-[22px]`} />
      </Field>
      <div className="grid grid-cols-2 gap-6">
        <Field label="Role" hint={lockRole ? "The owner’s role can’t be changed from a terminal." : `${ROLES[role].can.length} permissions · ${terminal ? "signs in with a PIN" : "no terminal login"}`}>
          <Select value={role} disabled={lockRole} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="4-digit PIN" hint={!terminal ? "Not needed for this role." : pinTaken ? "Another team member already uses that PIN." : isNew ? "They’ll use it to sign in on any terminal." : "Change it if it has been shared."}>
          <input inputMode="numeric" disabled={!terminal} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" className={`${inputCls} font-serif text-[28px] lining disabled:opacity-40`} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Field label="Phone">
          <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 16))} placeholder="024 000 0000" className={`${inputCls} lining`} />
        </Field>
        <Field label="Email">
          <input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 48))} placeholder="akosua@lushview.gh" className={inputCls} />
        </Field>
      </div>
      <div className={`border-t pt-5 ${K.line}`}>
        <Caps>This role can open</Caps>
        <p className={`mt-2 text-sm ${K.fg2}`}>{ROLES[role].can.length ? PERMS.filter((p) => ROLES[role].can.includes(p.id)).map((p) => p.label).join(" · ") : "Nothing on the terminal — kitchen staff work from the pass screen opened by a cashier."}</p>
      </div>
      <Pill
        tone="accent"
        disabled={!ok}
        onClick={() => {
          onSave({ name: name.trim(), role, pin: terminal ? pin : "", phone: phone.trim(), email: email.trim() });
          onClose();
        }}
      >
        {isNew ? "Add to the team" : "Save"}
      </Pill>
    </div>
  );
}
