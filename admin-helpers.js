const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const uri = process.env.MONGODB_URI;

async function getDashboardStats() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');

    const totalOrders = await db.collection('Orders').countDocuments();
    const totalProducts = await db.collection('Menu').countDocuments();
    const totalIngredients = await db.collection('Ingredients').countDocuments();
    const totalAddons = await db.collection('Add-ons').countDocuments();

    await client.close();

    return { totalOrders, totalProducts, totalIngredients, totalAddons };
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    return { totalOrders: 0, totalProducts: 0, totalIngredients: 0, totalAddons: 0 };
  }
}

async function getAnalyticsData() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const recentOrders = await db.collection('Orders').find().limit(10).toArray();
    await client.close();
    return { recentOrders };
  } catch (err) {
    console.error('Error getting analytics data:', err);
    return { recentOrders: [] };
  }
}

async function getProducts() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const products = await db.collection('Menu').find().toArray();
    await client.close();
    return products;
  } catch (err) {
    console.error('Error getting products:', err);
    return [];
  }
}

async function getProductById(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const product = await db.collection('Menu').findOne({ _id: new ObjectId(id) });
    await client.close();
    return product;
  } catch (err) {
    console.error('Error getting product by id:', err);
    return null;
  }
}

async function getOrders() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const orders = await db.collection('Orders').find().toArray();
    await client.close();
    return orders;
  } catch (err) {
    console.error('Error getting orders:', err);
    return [];
  }
}

async function getOrderById(id) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const order = await db.collection('Orders').findOne({ _id: new ObjectId(id) });
    await client.close();
    return order;
  } catch (err) {
    console.error('Error getting order by id:', err);
    return null;
  }
}

async function getStockData() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const ingredients = await db.collection('Ingredients').find().toArray();
    const addons = await db.collection('Add-ons').find().toArray();
    await client.close();
    return { ingredients, addons };
  } catch (err) {
    console.error('Error getting stock data:', err);
    return { ingredients: [], addons: [] };
  }
}

async function getDiscounts() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const discounts = await db.collection('Promos').find().toArray();
    await client.close();
    return discounts;
  } catch (err) {
    console.error('Error getting discounts:', err);
    return [];
  }
}

async function getMenu() {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db('blessingscafe');
    const menu = await db.collection('Menu').find().toArray();
    await client.close();
    return menu;
  } catch (err) {
    console.error('Error getting menu:', err);
    return [];
  }
}

module.exports = {
  getDashboardStats,
  getAnalyticsData,
  getProducts,
  getProductById,
  getOrders,
  getOrderById,
  getStockData,
  getDiscounts,
  getMenu
};
