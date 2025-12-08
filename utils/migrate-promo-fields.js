const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function migratePromoFields() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const promosCollection = db.collection('Promos');

    console.log('Starting promo migration...');

    const universalPromoId = '690e1287ac339935973d4614';

    const updateResult = await promosCollection.updateOne(
      { _id: new ObjectId(universalPromoId) },
      {
        $set: {
          applicableToAll: true,
          isActive: true,
          lastModified: new Date()
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      console.log('Universal promo not found. Attempting to find by event name...');
      const altResult = await promosCollection.updateOne(
        { event: 'fruiterism' },
        {
          $set: {
            applicableToAll: true,
            isActive: true,
            lastModified: new Date()
          }
        }
      );

      if (altResult.matchedCount > 0) {
        console.log('✓ Updated universal promo (fruiterism) by event name');
        console.log(`  - Set applicableToAll: true`);
        console.log(`  - Set isActive: true`);
      } else {
        console.log('✗ Could not find universal promo');
      }
    } else {
      console.log('✓ Updated universal promo by ID');
      console.log(`  - Set applicableToAll: true`);
      console.log(`  - Set isActive: true`);
    }

    const addApplicableToAllResult = await promosCollection.updateMany(
      { applicableToAll: { $exists: false } },
      {
        $set: {
          applicableToAll: false
        }
      }
    );

    if (addApplicableToAllResult.modifiedCount > 0) {
      console.log(`✓ Added applicableToAll field to ${addApplicableToAllResult.modifiedCount} promos`);
    }

    const allPromos = await promosCollection.find({}).toArray();
    console.log('\n📋 All Promos:');
    allPromos.forEach(promo => {
      console.log(`  - ${promo.event} | Category: "${promo.category}" | applicableToAll: ${promo.applicableToAll} | isActive: ${promo.isActive}`);
    });

    console.log('\n✓ Migration complete');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migratePromoFields();
