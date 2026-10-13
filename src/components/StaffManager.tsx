"use client";

import { LoadFailure } from "./LoadFailure";
import { ConfirmDialog } from "./ConfirmDialog";

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
  Trash2,
  UserCheck,
} from "lucide-react";
import { ROLE_PERMISSIONS, UserRole } from "@/lib/permissions";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify";

export const StaffManager: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const [staff, setStaff] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState<any | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  // Removing an account is owner-only and asks first: it cannot be undone.
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");

  // New staff form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStaff = useCallback(() => fetch("/api/staff")
    .then(res => { if (!res.ok) throw new Error("Request failed"); return res.json(); })
    .then(data => {
    setLoadError(null);
      if (data.staff) {
        setStaff(data.staff);
      }

    }).catch(() => setLoadError("Staff list could not be loaded. What is shown may be out of date.")), []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch("/api/staff", {
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
      setError(apiErrorMessage(e, "Could not reach the server. Please try again."));
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPinModal || !newPin) return;
    try {
      const data = await apiFetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_pin",
          userId: showPinModal.id,
          pin: newPin,
        }),
      });
      if (data.success) {
        setShowPinModal(null);
        setNewPin("");
        notify(`PIN updated for ${showPinModal.name}. Sessions for this account were signed out; a changed PIN must be used from a fresh sign-in.`, "ok");
        if (data.employee?.id === currentUser?.id) {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          window.location.reload();
          return;
        }
        fetchStaff();
      } else { setError(data.error || "Staff update failed"); }
    } catch (e) {
      console.error(e);
      setError(apiErrorMessage(e, "Could not reach the server. Please try again."));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal || !newPassword) return;
    try {
      const data = await apiFetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", userId: showPasswordModal.id, password: newPassword }),
      });
      if (data.success) {
        setShowPasswordModal(null);
        setNewPassword("");
        notify(`${showPasswordModal.name}'s password was changed. All existing sessions for this account are now signed out.`, "ok");
        if (data.employee?.id === currentUser?.id) {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          window.location.reload();
          return;
        }
      } else { setError(data.error || "Password reset failed"); }
    } catch (e) {
      console.error(e);
      setError(apiErrorMessage(e, "Could not reach the server. Please try again."));
    }
  };

  const handleDeleteEmployee = async () => {
    if (!confirmDelete) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_user", userId: confirmDelete.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setDeleteError(data.error || "The account was not removed. Nothing changed.");
        return;
      }
      const removedName = confirmDelete.name;
      setConfirmDelete(null);
      setNotice(`${removedName}'s account was removed. They can no longer sign in; past sales stay in the reports under that name.${data.note ? " " + data.note : ""}`);
      fetchStaff();
    } catch (e) {
      console.error(e);
      setDeleteError("Could not reach the server. The account was not removed.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_active",
          userId,
          isActive: !currentActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        notify(data.error || "Account status was not changed", "error");
        return;
      }
      fetchStaff();
    } catch (e) {
      console.error(e);
      notify(apiErrorMessage(e, "Could not reach the server. Account status was not changed."), "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <LoadFailure message={loadError} onRetry={fetchStaff} />
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
        {notice && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
              className="p-1.5 -m-1 text-emerald-300/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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
                        className={`px-2 py-0.5 rounded-md text-[0.625rem] font-bold ${
                          u.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-neutral-800 text-neutral-500"
                        }`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                      {!roleInfo?.terminalAccess && (
                        <span className="px-2 py-0.5 rounded-md text-[0.625rem] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
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
                      <span className="text-[0.6875rem] text-neutral-500">POS Login PIN:</span>
                      <span className="font-mono font-bold text-neutral-300">
                        Hidden
                      </span>
                    </div>
                  </div>

                  {/* Permissions tags */}
                  <div className="pt-2 text-[0.625rem] text-neutral-400 flex flex-wrap gap-1">
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

                <div className="mt-4 pt-3 border-t border-neutral-800 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => {
                      setShowPinModal(u);
                      setNewPin("");
                    }}
                    className="min-h-11 px-3 rounded-xl bg-neutral-800/70 hover:bg-neutral-700 border border-neutral-700 text-amber-300 font-semibold flex items-center gap-1.5 transition"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Change PIN</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordModal(u);
                      setNewPassword("");
                      setError("");
                    }}
                    className="min-h-11 px-3 rounded-xl bg-neutral-800/70 hover:bg-neutral-700 border border-neutral-700 text-amber-300 font-semibold flex items-center gap-1.5 transition"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Reset Password</span>
                  </button>
                  <button
                    onClick={() => handleToggleActive(u.id, u.isActive)}
                    className="min-h-11 px-3 rounded-xl bg-neutral-800/70 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-semibold transition"
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>

                  {/* Removing an account is the owner's call, and never your own:
                      the server refuses both, this only hides the button. */}
                  {currentUser?.role === "super_admin" && u.id !== currentUser?.id && (
                    <button
                      onClick={() => {
                        setConfirmDelete(u);
                        setDeleteError("");
                        setNotice("");
                      }}
                      className="min-h-11 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-1.5 transition sm:ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleAddEmployee}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleResetPassword}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleUpdatePin}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto"
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

      {/* CONFIRM: Remove staff account */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.name ?? "this"}${confirmDelete ? "'s" : ""} account?`}
        message="They disappear from the staff list and can never sign in again — password, PIN and phone number are wiped. Their past sales stay in the reports under their name. This cannot be undone."
        confirmLabel="Yes, delete account"
        cancelLabel="Keep the account"
        busy={deleteBusy}
        busyLabel="Removing…"
        error={deleteError}
        onConfirm={handleDeleteEmployee}
        onCancel={() => {
          setConfirmDelete(null);
          setDeleteError("");
        }}
      />
    </div>
  );
};
