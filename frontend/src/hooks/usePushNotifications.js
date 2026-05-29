import { useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

export const usePushNotifications = (authConfig) => {
  useEffect(() => {
    if (!authConfig) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    const subscribe = async () => {
      const reg = await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      if (existing) return;

      const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
      if (!res.ok) return;
      const { publicKey } = await res.json();
      if (!publicKey) return;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authConfig?.headers ?? {}),
        },
        body: JSON.stringify({ subscription }),
      });
    };

    if (Notification.permission === "granted") {
      subscribe().catch(() => {});
    } else {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") subscribe().catch(() => {});
      });
    }
  }, [authConfig]);
};
