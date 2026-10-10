"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users2,
  Plus,
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  X,
  UserCheck,
} from "lucide-react";
import { ROLE_PERMISSIONS, UserRole } from "@/lib/permissions";

export const StaffManager: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const [staff, setStaff] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState<any | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");

  // New staff form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");

  const fetchStaff = useCallback(() => fetch("/api/staff")
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
      if (data.staff) {
        setStaff(data.staff);
      }

    }).catch(console.error), []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_employee",
          name,
          email,
          role,
          pin,
          password,
          phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setName("");
        setEmail("");
        setPhone("");
        setPassword("");
        setPin("");
        fetchStaff();
      } else { setError(data.error || "Staff update failed"); }
    } catch (e) {
      console.error(e);
      setError("Could not reach the server. Please try again.");
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPinModal || !newPin) return;
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_pin",
          userId: showPinModal.id,
          pin: newPin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPinModal(null);
        setNewPin("");
        alert(`PIN updated for ${showPinModal.name}. Sessions for this account were signed out; a changed PIN must be used from a fresh sign-in.`);
        if (data.employee?.id === currentUser?.id) {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.reload();
          return;
        }
        fetchStaff();
      } else { setError(data.error || "Staff update failed"); }
    } catch (e) {
      console.error(e);
      setError("Could not reach the server. Please try again.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal || !newPassword) return;
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", userId: showPasswordModal.id, password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPasswordModal(null);
        setNewPassword("");
        alert(`${showPasswordModal.name}'s password was changed. All existing sessions for this account are now signed out.`);
        if (data.employee?.id === currentUser?.id) {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.reload();
          return;
        }
      } else { setError(data.error || "Password reset failed"); }
    } catch (e) {
      console.error(e);
      setError("Could not reach the server. Please try again.");
    }
  };

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    try {
      await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_active",
          userId,
          isActive: !currentActive,
        }),
      });
      fetchStaff();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users2 className="w-5 h-5 text-amber-500" />
            <span>Staff Roster & Role Permissions</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage restaurant employee accounts, 4-digit quick POS unlock PINs, and security roles
          </p>
        </div>

        <button
          onClick={() => { setShowAddModal(true); setError(""); }}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Staff List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((u) => {
            const roleInfo = ROLE_PERMISSIONS[u.role as UserRole];

            return (
              <div
                key={u.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-bold text-white text-sm shadow-md">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{u.name}</h4>
                        <span className="text-xs text-amber-400 font-medium">
                          {roleInfo?.label || u.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          u.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-neutral-800 text-neutral-500"
                        }`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                      {!roleInfo?.terminalAccess && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
                          No Terminal Access
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-neutral-400 py-2 border-y border-neutral-850">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{u.email}</span>
                    </div>
                    {u.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-neutral-500">POS Login PIN:</span>
                      <span className="font-mono font-bold text-neutral-300">
                        Hidden
                      </span>
                    </div>
                  </div>

                  {/* Permissions tags */}
                  <div className="pt-2 text-[10px] text-neutral-400 flex flex-wrap gap-1">
                    {roleInfo?.canAccessPos && (
                      <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                        POS
                      </span>
                    )}
                    {roleInfo?.canAccessKds && (
                      <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                        Docket Progress
                      </span>
                    )}
                    {roleInfo?.canModifyInventory && (
                      <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                        Inventory
                      </span>
                    )}
                    {roleInfo?.canIssueRefunds && (
                      <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                        Refunds
                      </span>
                    )}
                    {roleInfo?.canViewReports && (
                      <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                        Financial Reports
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowPinModal(u);
                        setNewPin("");
                      }}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Change PIN</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordModal(u);
                        setNewPassword("");
                        setError("");
                      }}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Reset Password</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleToggleActive(u.id, u.isActive)}
                    className="text-neutral-400 hover:text-white"
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAddEmployee}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Add New Employee</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwame Mensah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Email (Login)</label>
                <input
                  type="email"
                  required
                  placeholder="name@lushviewhotel.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Initial Password (12+ characters)</label>
                <input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white" />
                {error && <p role="alert" className="text-red-400">{error}</p>}
              </div>
              <div>
                <label className="text-neutral-300 block mb-1">Role & Authority</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="cashier">Cashier / Waiter</option>
                  <option value="cook">Cook / Head Chef</option>
                  <option value="manager">Restaurant Manager</option>
                  <option value="inventory_officer">Inventory Officer</option>
                  <option value="accountant">Accountant</option>
                  <option value="super_admin">Super Admin / Owner</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">4–8 Digit Quick POS PIN</label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  placeholder="1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-base"
                />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+1 (555) 998-1002"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Save Employee
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Reset Password</h3>
              <button type="button" onClick={() => setShowPasswordModal(null)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Setting a new password for {showPasswordModal.name}. Every existing
              session for this account is signed out immediately.
            </p>
            {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
            <div>
              <input
                type="password"
                minLength={12}
                maxLength={256}
                required
                autoFocus
                autoComplete="new-password"
                placeholder="New password (12+ characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full py-2 px-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowPasswordModal(null)} className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg">
                Reset Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Change PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleUpdatePin}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Update Quick POS PIN</h3>
              <button
                type="button"
                onClick={() => setShowPinModal(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">Updating PIN for {showPinModal.name}. Each staff member must have a unique PIN in this branch.</p>
            {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

            <div>
              <input
                type="password"
                maxLength={8}
                required
                autoFocus
                placeholder="4–8 digits"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full text-center text-3xl font-mono tracking-widest py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPinModal(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 text-black rounded-lg"
              >
                Save PIN
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
