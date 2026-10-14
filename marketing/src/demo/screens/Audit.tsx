"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Tone } from "../data";
import { download, stamp, toCSV } from "../money";
import { useStore } from "../store";
import { Badge, Card, cx } from "../ui";
import { OfficeHead } from "./Office";

const TONE: [RegExp, Tone][] = [
  [/refund|void|86|payout/i, "terra"], [/sale|sign in|served|restored|GRN|invoice|drawer opened|pay in/i, "forest"], [/discount|price|dish|recipe|menu/i, "sun"], [/stock|PO|purchas|ingredient|settings|staff|print/i, "cobalt"],
];
const toneFor = (action: string): Tone => TONE.find(([re]) => re.test(action))?.[1] ?? "ink";

export function Audit() {
  const { state, api } = useStore();
  const [q, setQ] = useState("");
  const [user, setUser] = useState("all");
  const [kind, setKind] = useState("all");
  const users = [...new Set(state.audit.map((a) => a.user))];
  const kinds = [...new Set(state.audit.map((a) => a.action))].sort();
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return state.audit.filter((a) => (user === "all" || a.user === user) && (kind === "all" || a.action === kind) && (!qq || `${a.action} ${a.entity} ${a.details}`.toLowerCase().includes(qq)));
  }, [state.audit, q, user, kind]);

  return (
    <div className="page">
      <OfficeHead module="audit" title="Audit trail" sub={`${state.audit.length} entries · every sale, refund, void, discount, price change, stock move and sign-in — with who and when`}
        actions={<>
          <select className="select !h-11 !w-auto" value={user} onChange={(e) => setUser(e.target.value)}><option value="all">Everyone</option>{users.map((u) => <option key={u}>{u}</option>)}</select>
          <select className="select !h-11 !w-auto" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All actions</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
          <label className="search w-[220px]"><Search size={16} strokeWidth={2.5} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search details…" /></label>
          <button type="button" className="btn btn-ink" onClick={() => { download("lushview-audit.csv", toCSV([["Timestamp", "User", "Action", "Entity", "Details"], ...list.map((a) => [new Date(a.at).toISOString(), a.user, a.action, a.entity, a.details])])); api.notify("Audit CSV downloaded", "info"); }}><Download size={16} strokeWidth={2.5} /> CSV</button>
        </>} />

      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.slice(0, 10).map((k) => <button key={k} type="button" className={cx("pill", kind === k && "is-active")} onClick={() => setKind(kind === k ? "all" : k)}><span className="dot" data-tone={toneFor(k)} />{k} · {state.audit.filter((a) => a.action === k).length}</button>)}
      </div>

      <Card pad={false}>
        <div className="tbl-wrap max-h-[64vh]">
          <table className="tbl">
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap num">{stamp(a.at)}</td>
                  <td className="strong whitespace-nowrap">{a.user}</td>
                  <td><Badge tone={toneFor(a.action)}>{a.action}</Badge></td>
                  <td className="whitespace-nowrap text-[var(--ink2)]">{a.entity}</td>
                  <td className="text-[var(--ink2)]">{a.details}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5}><div className="empty">No entries match</div></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
