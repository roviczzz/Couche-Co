const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function migrateCategories() {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 2
  });

  try {
    await client.connect();
    const db = client.db('blessingscafe');
    const categoriesCollection = db.collection('Categories');

    const existingCategories = await categoriesCollection.countDocuments();

    if (existingCategories > 0) {
      console.log('✅ Categories already exist. Skipping migration.');
      return;
    }

    const defaultCategories = [
      {
        name: 'Coffee',
        shortcode: 'CF',
        description: 'Premium coffee drinks - hot and cold options',
        order: 1,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Milktea',
        shortcode: 'MT',
        description: 'Creamy and delicious milk tea beverages',
        order: 2,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Fruit Tea',
        shortcode: 'FT',
        description: 'Refreshing fruit-based tea drinks',
        order: 3,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Pastries',
        shortcode: 'BK',
        description: 'Fresh baked goods and pastries',
        order: 4,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const result = await categoriesCollection.insertMany(defaultCategories);
    console.log(`✅ Successfully created ${result.insertedCount} default categories`);
    console.log('   - Coffee (CF)');
    console.log('   - Milktea (MT)');
    console.log('   - Fruit Tea (FT)');
    console.log('   - Pastries (BK)');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await client.close();
  }
}

migrateCategories()
  .then(() => {
    console.log('✅ Category migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Category migration failed:', error);
    process.exit(1);
  });
