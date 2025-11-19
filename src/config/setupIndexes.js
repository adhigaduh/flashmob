const { getDatabase } = require('./database');

/**
 * Create indexes for optimal query performance
 */
async function setupIndexes() {
    try {
        const db = getDatabase();
        const collection = db.collection('contentcards');

        // Create indexes for frequently queried fields
        await collection.createIndex({ createdAt: -1 }); // For sorting by recency
        await collection.createIndex({ content_type: 1 }); // For filtering
        await collection.createIndex({ language: 1 }); // For filtering
        await collection.createIndex({ reading_length: 1 }); // For filtering

        console.log('✓ Database indexes created');
    } catch (error) {
        console.error('Error creating indexes:', error);
    }
}

module.exports = { setupIndexes };
