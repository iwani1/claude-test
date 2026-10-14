"use client";

import type { ReactNode } from "react";
import { GROUPS, MODULES, can, type Module } from "../data";
import { currentUser, useStore } from "../store";
import { cx } from "../ui";

/** Page header for back-office modules: group kicker, sibling tabs in the group colour, title and actions. */
export function OfficeHead({ module, title, sub, actions }: { module: Module; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const meta = MODULES.find((m) => m.id === module)!;
  const group = GROUPS[meta.group];
  const siblings = MODULES.filter((m) => m.group === meta.group);
  return (
    <div className="mb-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="kicker flex items-center gap-2"><span className="dot" data-tone={group.tone} />{group.label}</span>
        <div className="subtabs" data-tone={group.tone}>
          {siblings.map((m) => (
            <button key={m.id} type="button" className={cx("subtab", m.id === module && "is-active")} disabled={!can(me.role, m.id)} onClick={() => api.go(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>
      <div className="page-head !mb-0">
        <div>
          <h1 className="page-title">{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
