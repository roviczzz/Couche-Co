const { MongoClient } = require('mongodb');
const cron = require('node-cron');

const uri = process.env.MONGODB_URI;

/**
 * Deactivates expired promos by setting isActive to false
 * for promos where endDate has passed and isActive is currently true
 */
async function deactivateExpiredPromos() {
  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const promosCollection = db.collection('Promos');

    const now = new Date();

    // Find promos that are expired and still active
    const expiredPromos = await promosCollection.find({
      endDate: { $lte: now },
      isActive: true
    }).toArray();

    if (expiredPromos.length === 0) {
      console.log(`[${new Date().toISOString()}] Promo deactivation check: No expired active promos found`);
      return { success: true, deactivatedCount: 0, promos: [] };
    }

    // Update all expired active promos to inactive
    const result = await promosCollection.updateMany(
      {
        endDate: { $lte: now },
        isActive: true
      },
      {
        $set: {
          isActive: false,
          lastModified: now
        }
      }
    );

    const deactivatedPromos = expiredPromos.map(promo => ({
      _id: promo._id,
      event: promo.event,
      endDate: promo.endDate
    }));

    console.log(`[${new Date().toISOString()}] Promo deactivation: ${result.modifiedCount} promos deactivated`);
    console.log('Deactivated promos:', deactivatedPromos.map(p => p.event).join(', '));

    return {
      success: true,
      deactivatedCount: result.modifiedCount,
      promos: deactivatedPromos
    };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error deactivating expired promos:`, error);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Manually trigger promo deactivation check (for testing)
 */
async function checkAndDeactivateExpiredPromos() {
  console.log(`[${new Date().toISOString()}] Manual promo deactivation check initiated`);
  const result = await deactivateExpiredPromos();

  if (result.success) {
    console.log(`[${new Date().toISOString()}] Manual check completed: ${result.deactivatedCount} promos deactivated`);
  } else {
    console.error(`[${new Date().toISOString()}] Manual check failed:`, result.error);
  }

  return result;
}

/**
 * Initialize the cron job for automatic promo deactivation
 * Runs every hour at minute 0
 */
function initializePromoDeactivationCron() {
  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Scheduled promo deactivation check starting...`);
    await deactivateExpiredPromos();
  });

  console.log('✅ Promo deactivation cron job initialized - runs every hour at :00');

  // Also run once immediately when the server starts
  setTimeout(async () => {
    console.log(`[${new Date().toISOString()}] Initial promo deactivation check on server start...`);
    await deactivateExpiredPromos();
  }, 5000); // Wait 5 seconds after server start
}

module.exports = {
  deactivateExpiredPromos,
  checkAndDeactivateExpiredPromos,
  initializePromoDeactivationCron
};
