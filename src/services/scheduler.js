const { setupIndexes } = require('../config/setupIndexes');

/**
 * Schedule regular database maintenance tasks
 */
function startScheduler() {
    // Reindex every 24 hours (86400000 ms)
    const REINDEX_INTERVAL = 24 * 60 * 60 * 1000;

    console.log('✓ Scheduler started');
    console.log(`  - Database reindexing will run every 24 hours`);

    // Run reindexing daily
    setInterval(async () => {
        try {
            console.log('\n🔄 Running scheduled database reindexing...');
            await setupIndexes();
            console.log('✓ Scheduled reindexing completed\n');
        } catch (error) {
            console.error('Error during scheduled reindexing:', error);
        }
    }, REINDEX_INTERVAL);
}

module.exports = {
    startScheduler
};
