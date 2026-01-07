import webPush from 'web-push';
import { db } from './db.js';

// Configure VAPID details
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  // Ensure mailto: prefix is present
  let vapidEmail = process.env.VAPID_EMAIL || 'mail@example.com';
  if (!vapidEmail.startsWith('mailto:')) {
    vapidEmail = `mailto:${vapidEmail}`;
  }
  webPush.setVapidDetails(
    vapidEmail,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️  VAPID keys not set. Push notifications will not work. Generate keys with: npx web-push generate-vapid-keys');
}

// Send notification to a specific user
export function notifyUser(userId, payload) {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  const message = JSON.stringify(payload);

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth
      }
    };

    webPush.sendNotification(subscription, message).catch(err => {
      console.error(`Failed to send push notification to user ${userId}:`, err.message);
      // Remove invalid subscription
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
    });
  }
}

// Send notification to all workspace members except one user
export function notifyWorkspaceMembers(workspaceId, payload, excludeUserId = null) {
  const subs = db.prepare(`
    SELECT ps.* FROM push_subscriptions ps
    JOIN workspace_members wm ON wm.user_id = ps.user_id
    WHERE wm.workspace_id = ? AND ps.user_id != ?
  `).all(workspaceId, excludeUserId ?? -1);

  console.log(`[Push] Notifying workspace ${workspaceId}, found ${subs.length} subscriptions (excluding user ${excludeUserId})`);

  const message = JSON.stringify(payload);

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth
      }
    };

    console.log(`[Push] Sending notification to user ${sub.user_id}:`, payload.title);
    webPush.sendNotification(subscription, message)
      .then(() => {
        console.log(`[Push] Successfully sent notification to user ${sub.user_id}`);
      })
      .catch(err => {
        console.error(`[Push] Failed to send push notification for workspace ${workspaceId} to user ${sub.user_id}:`, err.message);
        // Remove invalid subscription
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      });
  }
}
