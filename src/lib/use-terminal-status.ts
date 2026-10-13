"use client";
import { useSyncExternalStore } from "react";
import { getOfflineQueue } from "./offline-storage";
function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}
function subscribeQueue(notify: () => void) {
  window.addEventListener("storage", notify);
  const interval = setInterval(notify, 1000);
  return () => { window.removeEventListener("storage", notify); clearInterval(interval); };
}
export function useOnlineStatus() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
export function useOfflineQueueCount(branchId: number) {
  return useSyncExternalStore(subscribeQueue, () => getOfflineQueue(branchId).length, () => 0);
}
