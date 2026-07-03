const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('../config/db');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Constants ───────────────────────────────────────────────────────────────
const SUBSCRIPTION_AMOUNT_PAISE = 9900; // ₹99/month
const TRIAL_DAYS = 30;

// ─── Helper: get userId from body or query ───────────────────────────────────
const getUserId = (req) => req.body.user_id || req.params.userId || null;

// ─── Create Order (One-time payment) ────────────────────────────────────────
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt = 'receipt_' + Date.now() } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise (₹1)' });
    }

    const order = await razorpay.orders.create({ amount, currency, receipt });
    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// ─── Create Subscription (Auto-renewal with 30-day free trial) ───────────────
router.post('/create-subscription', async (req, res) => {
  try {
    const { plan_id, total_count = 12, user_id } = req.body;
    console.log('create-subscription called with user_id:', user_id, 'plan_id:', plan_id);
    let resolvedPlanId = plan_id;

    if (!resolvedPlanId) {
      // Auto-create a ₹99/month plan
      const plan = await razorpay.plans.create({
        period: 'monthly',
        interval: 1,
        item: {
          name: 'Managio Pro – ₹99/month (1st Month Free)',
          amount: SUBSCRIPTION_AMOUNT_PAISE,
          currency: 'INR',
          description: 'Monthly subscription with 30-day free trial',
        },
      });
      resolvedPlanId = plan.id;
      console.log('Auto-created Razorpay plan:', resolvedPlanId);
    }

    // Check if user has already used a trial
    let hasUsedTrial = false;
    if (user_id) {
      const [rows] = await db.execute('SELECT trial_start_date FROM users WHERE id = ?', [user_id]);
      if (rows.length > 0 && rows[0].trial_start_date) {
        hasUsedTrial = true;
      }
    }

    // Build subscription parameters
    const subscriptionParams = {
      plan_id: resolvedPlanId,
      customer_notify: 1,
      total_count: total_count,
    };

    let startAt = null;
    // Only delay the charge if they haven't used their trial
    if (!hasUsedTrial) {
      startAt = Math.floor(Date.now() / 1000) + (TRIAL_DAYS * 24 * 60 * 60) + 60;
      subscriptionParams.start_at = startAt;
      console.log('User is eligible for trial. Delaying first charge to:', new Date(startAt * 1000).toISOString());
    } else {
      console.log('User has already used a trial. Charging immediately.');
    }

    const subscription = await razorpay.subscriptions.create(subscriptionParams);

    console.log('Subscription created:', subscription.id, 'status:', subscription.status, 'start_at:', startAt ? new Date(startAt * 1000).toISOString() : 'immediate');

    // If user_id provided, link subscription + trial in DB
    if (user_id) {
      const now = new Date();
      
      if (!hasUsedTrial) {
        // User gets a trial
        const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        await db.execute(
          `UPDATE users
           SET subscription_status = 'trial',
               razorpay_subscription_id = ?,
               razorpay_plan_id = ?,
               trial_start_date = ?,
               trial_end_date = ?,
               subscription_start_date = ?,
               subscription_end_date = ?,
               last_payment_status = 'trial_started'
           WHERE id = ?`,
          [subscription.id, resolvedPlanId, now, trialEnd, now, trialEnd, user_id]
        );
        console.log('Trial subscription linked to user:', user_id);
      } else {
        // User already used trial, they are directly subscribing
        // Status remains 'expired' or 'pending' until verify-payment activates it
        await db.execute(
          `UPDATE users
           SET razorpay_subscription_id = ?,
               razorpay_plan_id = ?,
               last_payment_status = 'pending_payment'
           WHERE id = ?`,
          [subscription.id, resolvedPlanId, user_id]
        );
        console.log('Paid subscription initialized for user (pending verification):', user_id);
      }
    }

    res.json({
      success: true,
      subscription_id: subscription.id,
      short_url: subscription.short_url,
      plan_id: resolvedPlanId,
    });
  } catch (error) {
    console.error('Error creating Razorpay subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription', details: error.message });
  }
});

// ─── Start Free Trial (no payment taken yet, just records trial in DB) ───────
router.post('/start-trial', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    await db.execute(
      `UPDATE users
       SET subscription_status = 'trial',
           trial_start_date = ?,
           trial_end_date = ?,
           subscription_start_date = ?,
           subscription_end_date = ?,
           last_payment_status = 'trial_started'
       WHERE id = ?`,
      [now, trialEnd, now, trialEnd, user_id]
    );

    res.json({
      success: true,
      message: 'Free trial started',
      trial_start_date: now,
      trial_end_date: trialEnd,
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    res.status(500).json({ error: 'Failed to start trial', details: error.message });
  }
});

// ─── Get Subscription Status ─────────────────────────────────────────────────
router.get('/subscription-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await db.execute(
      `SELECT id, subscription_status, razorpay_subscription_id, razorpay_plan_id,
              trial_start_date, trial_end_date,
              subscription_start_date, subscription_end_date,
              last_payment_status
       FROM users WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const now = new Date();

    // Auto-expire trial if past trial_end_date
    if (user.subscription_status === 'trial' && user.trial_end_date && new Date(user.trial_end_date) < now) {
      await db.execute(
        `UPDATE users SET subscription_status = 'expired', last_payment_status = 'trial_expired' WHERE id = ?`,
        [userId]
      );
      user.subscription_status = 'expired';
      user.last_payment_status = 'trial_expired';
    }

    // Auto-expire active subscription if past subscription_end_date
    if (user.subscription_status === 'active' && user.subscription_end_date && new Date(user.subscription_end_date) < now) {
      await db.execute(
        `UPDATE users SET subscription_status = 'expired', last_payment_status = 'expired' WHERE id = ?`,
        [userId]
      );
      user.subscription_status = 'expired';
      user.last_payment_status = 'expired';
    }

    // Compute whether user has access right now
    let hasAccess = false;
    if (user.subscription_status === 'trial' || user.subscription_status === 'active') {
      hasAccess = true;
    }

    res.json({
      success: true,
      hasAccess,
      subscription_status: user.subscription_status,
      razorpay_subscription_id: user.razorpay_subscription_id,
      razorpay_plan_id: user.razorpay_plan_id,
      trial_start_date: user.trial_start_date,
      trial_end_date: user.trial_end_date,
      subscription_start_date: user.subscription_start_date,
      subscription_end_date: user.subscription_end_date,
      last_payment_status: user.last_payment_status,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status', details: error.message });
  }
});

// ─── Verify Payment Signature ────────────────────────────────────────────────
router.post('/verify-payment', async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
    user_id,
  } = req.body;

  console.log('verify-payment called:', { user_id, razorpay_subscription_id, razorpay_payment_id: razorpay_payment_id ? razorpay_payment_id.substring(0, 10) : 'none (free trial)' });

  // For free trial subscriptions, Razorpay returns subscription_id + signature but NO payment_id
  // For paid subscriptions, it returns payment_id + subscription_id + signature
  if (!razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Missing signature' });
  }

  if (!razorpay_subscription_id && !razorpay_order_id) {
    return res.status(400).json({ success: false, error: 'Must provide subscription_id or order_id' });
  }

  let generated_signature = '';
  const isFreeTrial = !razorpay_payment_id && razorpay_subscription_id;

  if (razorpay_subscription_id && razorpay_payment_id) {
    // Paid subscription: signature = HMAC(payment_id + '|' + subscription_id)
    generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_payment_id + '|' + razorpay_subscription_id)
      .digest('hex');
  } else if (razorpay_subscription_id && !razorpay_payment_id) {
    // Free trial subscription: signature = HMAC(subscription_id)
    generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_subscription_id)
      .digest('hex');
  } else if (razorpay_order_id && razorpay_payment_id) {
    // One-time order: signature = HMAC(order_id + '|' + payment_id)
    generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');
  } else {
    return res.status(400).json({ success: false, error: 'Invalid combination of payment fields' });
  }

  if (generated_signature === razorpay_signature) {
    // Signature verified — update user subscription in DB
    if (user_id && razorpay_subscription_id) {
      if (isFreeTrial) {
        // Free trial: keep status as 'trial' (already set by create-subscription)
        // Just confirm the subscription_id is linked
        console.log('Free trial subscription verified for user:', user_id);
      } else {
        // Paid subscription: activate immediately
        const now = new Date();
        const subEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db.execute(
          `UPDATE users
           SET subscription_status = 'active',
               razorpay_subscription_id = ?,
               subscription_start_date = ?,
               subscription_end_date = ?,
               last_payment_status = 'paid'
           WHERE id = ?`,
          [razorpay_subscription_id, now, subEnd, user_id]
        );
        console.log('Payment verified and subscription activated for user:', user_id);
      }
    }
    res.json({ success: true, message: 'Payment verified successfully' });
  } else {
    console.log('Signature mismatch:', { generated: generated_signature.substring(0, 10), received: razorpay_signature.substring(0, 10), isFreeTrial });
    res.status(400).json({ success: false, error: 'Invalid signature' });
  }
});

// ─── Razorpay Webhook Handler ─────────────────────────────────────────────────
// IMPORTANT: This route must be registered with express.raw() in index.js
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Webhook signature mismatch');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body);
    const eventType = event.event;
    console.log('Razorpay webhook event:', eventType);

    if (eventType === 'subscription.charged') {
      // Recurring payment succeeded
      const sub = event.payload?.subscription?.entity;
      if (sub) {
        const now = new Date();
        const subEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db.execute(
          `UPDATE users
           SET subscription_status = 'active',
               subscription_start_date = ?,
               subscription_end_date = ?,
               last_payment_status = 'charged'
           WHERE razorpay_subscription_id = ?`,
          [now, subEnd, sub.id]
        );
        console.log('Subscription charged:', sub.id);
      }
    } else if (eventType === 'subscription.halted' || eventType === 'subscription.cancelled') {
      const sub = event.payload?.subscription?.entity;
      if (sub) {
        await db.execute(
          `UPDATE users SET subscription_status = 'expired', last_payment_status = 'halted' WHERE razorpay_subscription_id = ?`,
          [sub.id]
        );
        console.log('Subscription halted/cancelled:', sub.id);
      }
    } else if (eventType === 'payment.failed') {
      const payment = event.payload?.payment?.entity;
      if (payment?.subscription_id) {
        await db.execute(
          `UPDATE users SET subscription_status = 'expired', last_payment_status = 'payment_failed' WHERE razorpay_subscription_id = ?`,
          [payment.subscription_id]
        );
        console.log('Payment failed for subscription:', payment.subscription_id);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
