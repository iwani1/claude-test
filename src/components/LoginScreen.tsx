"use client";

import React, { useState } from "react";
import {
  Store,
  Mail,
  Lock,
  Delete,
  LogIn,
  ShieldCheck,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { LogoTraceLoader, TactileButton } from "@/components/interface-studies";

interface LoginScreenProps {
  onAuthenticated: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<"pin" | "password">("password");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const submitCredentials = async (payload: Record<string, string>) => {
    setIsBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onAuthenticated(data.user);
      } else {
        setError(data.error || "Sign in failed. Please check your credentials.");
        setPin("");
      }
    } catch {
      setError("Unable to reach the authentication server.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 4 || isBusy) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === 4) {
      submitCredentials({ pin: next });
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCredentials({ email, password });
  };

  return (
    <div className="h-dvh w-full flex bg-neutral-950 overflow-hidden">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('/menu-images/grilled-chicken.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-950/90 to-amber-950/60" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-white tracking-tight">Lush View Hotel</div>
            <div className="text-xs text-amber-400 font-medium">Production POS & Inventory System</div>
          </div>
        </div>

        <div className="relative z-10 space-y-5">
          <h1 className="text-4xl font-bold text-white leading-tight max-w-md">
            Akwaaba! Restaurant, Bar & Room Service Operations.
          </h1>
          <p className="text-sm text-neutral-300 max-w-md leading-relaxed">
            Cash and MoMo tender, thermal kitchen dockets, recipe-linked ingredient inventory,
            GRA VAT compliance, and live management telemetry.
          </p>

          <div className="p-3.5 rounded-xl max-w-md border border-orange-500/30 bg-orange-500/10">
            <div className="text-xs font-bold text-orange-300 uppercase tracking-wide">
              Kitchen Docket Hand-Off Workflow
            </div>
            <div className="text-[0.6875rem] text-neutral-300 mt-1 leading-relaxed">
              Kitchen personnel operate without digital screens. Front-of-house staff print the thermal
              order docket immediately upon ticket creation and hand it to the kitchen line.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md pt-1">
            {[
              { label: "Cash & MoMo", value: "Verified Tenders" },
              { label: "Inventory", value: "Recipe Deductions" },
              { label: "GRA Tax", value: "Standard VAT" },
            ].map((f) => (
              <div
                key={f.label}
                className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className="text-xs font-bold text-amber-400">{f.value}</div>
                <div className="text-[0.625rem] text-neutral-400 mt-0.5">{f.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[0.6875rem] text-neutral-500 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Scrypt password hashing &amp; signed, expiring sessions</span>
        </div>
      </div>

      {/* Right authentication panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white">Lush View Hotel</div>
              <div className="text-[0.6875rem] text-amber-400">Terminal Authentication</div>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-xl font-bold text-white">Staff Sign In</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Enter your authorized 4-digit PIN or work credentials to unlock the register.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
            <button
              onClick={() => { setMode("pin"); setError(""); }}
              className={`py-2 rounded-lg transition ${
                mode === "pin" ? "bg-amber-500 text-black shadow-xs font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              Employee PIN
            </button>
            <button
              onClick={() => { setMode("password"); setError(""); }}
              className={`py-2 rounded-lg transition ${
                mode === "password" ? "bg-amber-500 text-black shadow-xs font-bold" : "text-neutral-400 hover:text-white"
              }`}
            >
              Email & Password
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* PIN pad */}
          {mode === "pin" && (
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-xl border flex items-center justify-center text-2xl font-bold transition ${
                      pin.length > i
                        ? "bg-amber-500/15 border-amber-500 text-amber-400"
                        : "bg-neutral-900 border-neutral-800 text-neutral-700"
                    }`}
                  >
                    {pin.length > i ? "•" : ""}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    onClick={() => handlePinDigit(d)}
                    disabled={isBusy}
                    className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-amber-500 active:text-black border border-neutral-800 text-lg font-bold text-white transition disabled:opacity-50"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => { setPin(""); setError(""); }}
                  disabled={isBusy}
                  className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-400 transition disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  onClick={() => handlePinDigit("0")}
                  disabled={isBusy}
                  className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-amber-500 active:text-black border border-neutral-800 text-lg font-bold text-white transition disabled:opacity-50"
                >
                  0
                </button>
                <button
                  onClick={() => setPin(pin.slice(0, -1))}
                  disabled={isBusy}
                  className="h-14 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 flex items-center justify-center transition disabled:opacity-50"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {isBusy && (
                <div className="flex items-center justify-center text-xs text-amber-400">
                  <LogoTraceLoader label="Verifying authorization..." />
                </div>
              )}
            </div>
          )}

          {/* Email + password */}
          {mode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-300 block mb-1.5 font-medium">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@lushviewhotel.net"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-300 block mb-1.5 font-medium">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <TactileButton
                type="submit"
                disabled={isBusy}
                toneClass="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
                className="w-full h-11 rounded-xl disabled:opacity-50"
              >
                {isBusy ? (
                  <LogoTraceLoader label="Authenticating..." />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Terminal</span>
                  </>
                )}
              </TactileButton>
            </form>
          )}

          {/* Security advisory */}
          <div className="pt-3 border-t border-neutral-800/80 text-center">
            <p className="text-[0.6875rem] text-neutral-500">
              Authorized personnel only. All access attempts and transactions are logged in the GRA-compliant security audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
