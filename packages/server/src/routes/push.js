import { Router } from 'express';
import webPush from 'web-push';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  res.json({ vapidPublicKey: publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', requireAuth, (req, res) => {
  try {
    // Accept both { subscription: {...} } and direct {...} formats
    const subscription = req.body.subscription || req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const { endpoint, keys } = subscription;

    // Insert or replace subscription
    db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
      VALUES (?, ?, ?, ?)
    `).run(req.session.userId, endpoint, keys.p256dh, keys.auth);

    res.json({ ok: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unsubscribe from push notifications
router.delete('/subscribe', requireAuth, (req, res) => {
  try {
    // Delete all subscriptions for this user
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.session.userId);

    res.json({ ok: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send test notification
router.post('/test', requireAuth, (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      return res.status(500).json({ error: 'VAPID keys not configured' });
    }

    // Ensure mailto: prefix is present
    let vapidEmail = process.env.VAPID_EMAIL || 'test@example.com';
    if (!vapidEmail.startsWith('mailto:')) {
      vapidEmail = `mailto:${vapidEmail}`;
    }
    webPush.setVapidDetails(vapidEmail, publicKey, privateKey);

    // Get user's subscriptions
    const subscriptions = db.prepare(
      'SELECT * FROM push_subscriptions WHERE user_id = ?'
    ).all(req.session.userId);

    if (subscriptions.length === 0) {
      return res.status(400).json({ error: 'No push subscription found' });
    }

    const payload = JSON.stringify({
      title: 'Test-Benachrichtigung',
      body: 'Push-Benachrichtigungen funktionieren!',
      data: { test: true }
    });

    // Send to all user's devices
    const sendPromises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };

      return webPush.sendNotification(pushSubscription, payload).catch(error => {
        console.error('Push send error:', error);
        // If subscription is invalid or expired, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
        // If JWT token is bad (403), the subscription was created with different VAPID keys
        if (error.statusCode === 403) {
          console.error('BadJwtToken error - subscription may have been created with different VAPID keys');
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
        throw error;
      });
    });

    Promise.all(sendPromises)
      .then(() => {
        res.json({ ok: true, sent: subscriptions.length });
      })
      .catch(error => {
        console.error('Test notification error:', error);
        // Provide more helpful error message
        let errorMsg = error.message;
        if (error.body && error.body.includes('BadJwtToken')) {
          errorMsg = 'Push-Abonnement ungültig. Bitte Push deaktivieren und erneut aktivieren.';
        }
        res.status(500).json({ error: errorMsg, details: error.body });
      });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
