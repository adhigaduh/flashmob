const { MongoClient } = require('mongodb');
require('dotenv').config();

let db = null;
let client = null;

async function connectToDatabase() {
    if (db) {
        return db;
    }

    try {
        client = new MongoClient(process.env.MONGO_URI);
        await client.connect();
        db = client.db('test');
        console.log('✓ Connected to MongoDB');
        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call connectToDatabase() first.');
    }
    return db;
}

async function closeDatabase() {
    if (client) {
        await client.close();
        db = null;
        client = null;
        console.log('✓ MongoDB connection closed');
    }
}

module.exports = {
    connectToDatabase,
    getDatabase,
    closeDatabase
};
