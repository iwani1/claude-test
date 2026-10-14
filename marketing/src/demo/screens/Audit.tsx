"use client";

import { useState } from "react";
import { useDemo, type AuditEvent } from "../store";
import { inputCls, K, Num, PageHead, Rows, Tab, TextLink, whenOf } from "../ui";
import { saveText } from "./Reports";

type Entity = AuditEvent["entity"] | "all";
const ENTITIES: Entity[] = ["all", "order", "payment", "shift", "stock", "menu", "staff", "settings", "system"];

export function Audit() {
  const { state, dispatch, now } = useDemo();
  const [entity, setEntity] = useState<Entity>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(60);
  const list = state.audit.filter((e) => (entity === "all" || e.entity === entity) && (!q || `${e.userName} ${e.action} ${e.details}`.toLowerCase().includes(q.toLowerCase())));
  const users = new Set(state.audit.map((e) => e.userName)).size;

  const exportCsv = () => {
    const rows = [["Timestamp", "User", "Action", "Entity", "Details"], ...list.map((e) => [new Date(e.at).toISOString(), e.userName, e.action, e.entity, e.details])];
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    saveText(`lushview-audit-${new Date(now).toISOString().slice(0, 10)}.csv`, csv);
    dispatch({ type: "exported", what: `Audit log CSV · ${list.length} rows` });
  };

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Audit log" title="Who did what, when." lede={`${state.audit.length} events from ${users} people — every sale, void, refund, price change, stock movement and sign-in. Append-only; nothing here can be edited or deleted from the terminal.`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the log…" className={`${inputCls} w-56 text-sm`} />
        <TextLink tone="fg2" onClick={exportCsv}>
          Export CSV
        </TextLink>
      </PageHead>

      <div className="mt-10 flex flex-wrap gap-7">
        {ENTITIES.map((e) => (
          <Tab key={e} name="entity" on={entity === e} onClick={() => setEntity(e)}>
            {e === "all" ? `All · ${state.audit.length}` : `${e} · ${state.audit.filter((x) => x.entity === e).length}`}
          </Tab>
        ))}
      </div>

      <div className="mt-6">
        <Rows head={["Timestamp", "User", "Action", "Entity", "Details"]} lastRight={false}>
          {list.slice(0, limit).map((e) => (
            <tr key={e.id}>
              <td className={`whitespace-nowrap py-3 pr-6 ${K.fg3}`}>
                <Num>{whenOf(e.at, now)}</Num>
              </td>
              <td className="py-3 pr-6">{e.userName}</td>
              <td className="py-3 pr-6 font-serif text-[16px]">{e.action}</td>
              <td className={`py-3 pr-6 text-[11px] font-semibold uppercase tracking-[.16em] ${e.entity === "payment" ? K.accent : e.entity === "settings" || e.entity === "staff" ? K.warn : K.fg3}`}>{e.entity}</td>
              <td className={`py-3 ${K.fg2}`}>{e.details}</td>
            </tr>
          ))}
        </Rows>
        {list.length > limit && (
          <div className="mt-6">
            <TextLink tone="fg2" onClick={() => setLimit(limit + 60)}>
              Show {Math.min(60, list.length - limit)} more
            </TextLink>
          </div>
        )}
        {!list.length && <p className={`py-10 font-serif text-[22px] italic ${K.fg3}`}>Nothing matches.</p>}
      </div>
    </div>
  );
}
