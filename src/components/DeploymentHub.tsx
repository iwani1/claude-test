"use client";
import React from "react";
import { ShieldCheck, Database, Server } from "lucide-react";
export const DeploymentHub: React.FC = () => (
  <section className="p-8 max-w-4xl mx-auto space-y-6 text-neutral-200">
    <h1 className="text-2xl font-bold">Deployment & Security</h1>
    <p className="text-neutral-400">Use the PostgreSQL deployment guide included with the source. Do not deploy the original ZIP or import the legacy MySQL schema.</p>
    {[
      { Icon: Database, title: "PostgreSQL only", text: "Provision PostgreSQL 16+ and separate maintenance/runtime logins. Run npm run db:migrate. Row-level security and branch foreign keys are mandatory. The runtime login must not own tables or bypass row security." },
      { Icon: ShieldCheck, title: "No default credentials", text: "Generate AUTH_SECRET locally, configure HTTPS, and bootstrap an owner using explicit credentials. Passwords and PINs are hashed. Sessions expire after eight hours; staff roles and active status are checked on every request." },
      { Icon: Server, title: "Build and verify", text: "On Node.js 22 LTS: npm ci, npm run typecheck, npm run test:security, npm run build, then npm start behind an HTTPS reverse proxy. Check your hosting plan supports a persistent Node process and PostgreSQL connectivity." },
    ].map(({ Icon, title, text }) => (
      <article key={title} className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold flex items-center gap-3 mb-3"><Icon className="w-5 h-5 text-amber-400" />{title}</h2>
        <p className="text-sm leading-relaxed text-neutral-400">{text}</p>
      </article>
    ))}
    <p className="text-sm text-amber-300">Existing populated installations require a reviewed branch-ownership data migration. The bootstrap command refuses existing data. Cash/MoMo and refunds are manual records, not live payment gateway integrations.</p>
    <p className="text-xs text-neutral-500">Full instructions: GREENGEEKS_DEPLOYMENT_GUIDE.md · Security model: SECURITY.md</p>
  </section>
);
