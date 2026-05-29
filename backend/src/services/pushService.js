import webpush from "web-push";
import AppSettings from "../models/AppSettings.js";

const PUSH_SUB_KEY = "push.adminSubscription";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:agustinsosa.dev@gmail.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export const getVapidPublicKey = () => vapidPublicKey || null;

export const saveAdminPushSubscription = async (subscription) => {
  await AppSettings.findOneAndUpdate(
    { key: PUSH_SUB_KEY },
    { $set: { key: PUSH_SUB_KEY, value: subscription } },
    { upsert: true },
  );
};

export const sendPushToAdmin = async (payload) => {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  const record = await AppSettings.findOne({ key: PUSH_SUB_KEY }).lean();
  if (!record?.value) return;
  try {
    await webpush.sendNotification(record.value, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await AppSettings.deleteOne({ key: PUSH_SUB_KEY });
    } else {
      console.error("[push] sendNotification error:", err.message);
    }
  }
};
