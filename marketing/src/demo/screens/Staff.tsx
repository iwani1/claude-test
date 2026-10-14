"use client";

import { Check, UserPlus } from "lucide-react";
import { useState } from "react";
import { MODULES, ROLE_LABEL, ROLE_MODULES, type Role, type Staff as StaffT, type Tone } from "../data";
import { stamp } from "../money";
import { currentUser, useStore } from "../store";
import { Avatar, Badge, Card, Field, Modal, Toggle, cx } from "../ui";
import { OfficeHead } from "./Office";

const ROLES: Role[] = ["owner", "manager", "cashier", "inventory", "accountant", "cook"];
const TONES: Tone[] = ["sun", "forest", "terra", "cobalt", "ink"];

export function Staff() {
  const { state } = useStore();
  const me = currentUser(state)!;
  const [edit, setEdit] = useState<StaffT | "new" | null>(null);
  return (
    <div className="page">
      <OfficeHead module="staff" title="Staff & roles" sub={`${state.staff.filter((s) => s.active).length} active · a PIN opens exactly the modules its role allows`}
        actions={<button type="button" className="btn btn-ink" onClick={() => setEdit("new")}><UserPlus size={16} strokeWidth={2.5} /> Add staff</button>} />

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
        {state.staff.map((s) => (
          <button key={s.id} type="button" className={cx("card p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--ink)]", !s.active && "opacity-50")} onClick={() => setEdit(s)}>
            <div className="flex items-center gap-3">
              <Avatar initials={s.initials} tone={s.color} size="lg" />
              <div className="min-w-0"><div className="d truncate text-[16px] font-bold">{s.name}</div><Badge tone={s.role === "owner" ? "terra" : s.role === "manager" ? "cobalt" : s.role === "cook" ? "ink" : "forest"}>{ROLE_LABEL[s.role]}</Badge></div>
            </div>
            <div className="mt-3 text-[12px] font-semibold text-[var(--ink3)]">{s.active ? `${ROLE_MODULES[s.role].length} modules` : "Deactivated"}{s.lastSignIn ? ` · last in ${stamp(s.lastSignIn)}` : ""}{s.id === me.id ? " · you" : ""}</div>
          </button>
        ))}
      </div>

      <Card className="mt-5" title="Permissions matrix" actions={<span className="text-[12px] font-bold text-[var(--ink3)]">matches the live POS</span>} pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Module</th>{ROLES.map((r) => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.id}>
                  <td className="strong"><span className="dot mr-2 align-middle" data-tone={m.group === "service" ? "sun" : m.group === "stock" ? "forest" : m.group === "money" ? "terra" : "cobalt"} />{m.label}</td>
                  {ROLES.map((r) => <td key={r} className="text-center">{ROLE_MODULES[r].includes(m.id) ? <Check size={16} strokeWidth={3} className="inline c-forest" /> : <span className="text-[var(--ink4)]">—</span>}</td>)}
                </tr>
              ))}
              <tr><td className="strong">Approve refunds & voids</td>{ROLES.map((r) => <td key={r} className="text-center">{r === "owner" || r === "manager" ? <Check size={16} strokeWidth={3} className="inline c-forest" /> : <span className="text-[var(--ink4)]">—</span>}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Card>

      {edit && <StaffSheet staff={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function StaffSheet({ staff, onClose }: { staff: StaffT | null; onClose: () => void }) {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const [name, setName] = useState(staff?.name ?? "");
  const [role, setRole] = useState<Role>(staff?.role ?? "cashier");
  const [pin, setPin] = useState(staff?.pin ?? "");
  const [color, setColor] = useState<Tone>(staff?.color ?? "forest");
  const [active, setActive] = useState(staff?.active ?? true);
  const okPin = /^\d{4}$/.test(pin) && !state.staff.some((s) => s.pin === pin && s.id !== staff?.id);
  const initials = name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
  const save = () => {
    api.saveStaff({ id: staff?.id ?? name.toLowerCase().replace(/[^a-z]+/g, "") + Date.now().toString(36).slice(-3), name: name.trim(), initials, role, pin, color, active, lastSignIn: staff?.lastSignIn ?? null });
    onClose();
  };
  return (
    <Modal title={staff ? staff.name : "New staff member"} sub={staff ? `${ROLE_LABEL[staff.role]} · PIN and role changes are logged` : "They can sign in as soon as you save"} onClose={onClose}
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-ink grow" disabled={!name.trim() || !okPin} onClick={save}>{staff ? "Save" : "Add"}</button></>}>
      <div className="flex items-center gap-3"><Avatar initials={initials} tone={color} size="xl" /><div className="flex gap-1.5">{TONES.map((t) => <button key={t} type="button" className={cx("h-8 w-8 rounded-lg border-2", color === t ? "border-[var(--ink)]" : "border-transparent")} data-tone={t} style={{ background: "var(--c)" }} onClick={() => setColor(t)} aria-label={t} />)}</div></div>
      <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role"><select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
        <Field label="4-digit PIN" hint={pin && !okPin ? <span className="c-terra">Must be 4 digits and unique</span> : undefined}><input className="input" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" /></Field>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold text-[var(--ink3)]">Opens: {ROLE_MODULES[role].map((m) => <span key={m} className="rounded-md bg-[var(--cream2)] px-1.5 py-0.5 c-ink">{MODULES.find((x) => x.id === m)?.label}</span>)}</div>
      {staff && staff.id !== me.id && <div className="flex items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3"><span className="font-bold">{active ? "Active — can sign in" : "Deactivated"}</span><Toggle on={active} onChange={setActive} /></div>}
    </Modal>
  );
}
