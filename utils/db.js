const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

class DatabaseConnection {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnecting = false;
  }

  async connect() {
    if (this.db) {
      return this.db;
    }

    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.db;
    }

    this.isConnecting = true;

    try {
      this.client = new MongoClient(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000
      });

      await this.client.connect();
      this.db = this.client.db('blessingscafe');
      console.log('MongoDB connection established');
      
      this.isConnecting = false;
      return this.db;
    } catch (error) {
      this.isConnecting = false;
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('MongoDB connection closed');
    }
  }
}

const dbConnection = new DatabaseConnection();

module.exports = dbConnection;
