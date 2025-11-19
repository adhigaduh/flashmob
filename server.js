const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const { connectToDatabase } = require('./src/config/database');
const { setupIndexes } = require('./src/config/setupIndexes');
const { prewarmCache } = require('./src/services/cardSelector');
const { deliverCard, submitFeedback, getUserStats, showMeLater, resetSession } = require('./src/controllers/cardController');
const { getUsageStats, trackShare } = require('./src/services/analytics');
const { getSession } = require('./src/services/cookieManager');
const { startScheduler } = require('./src/services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware (relaxed CSP for development)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));

// Compression middleware (must be early in the chain)
app.use(compression());

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser middleware
app.use(cookieParser());

// Rate limiting: 100 requests per hour per IP
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Serve static files (for simple frontend)
app.use(express.static('public'));

// API Routes
app.get('/api/card', deliverCard);
app.post('/api/card/:cardId/feedback', submitFeedback);
app.post('/api/card/:cardId/later', showMeLater);
app.post('/api/card/:cardId/share', async (req, res) => {
    try {
        const { cardId } = req.params;
        const session = getSession(req);
        await trackShare(cardId, session.sessionId || 'anonymous');
        res.json({ success: true, message: 'Share tracked' });
    } catch (error) {
        console.error('Error tracking share:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/api/reset', resetSession);
app.get('/api/stats', getUserStats);
app.get('/api/analytics', async (req, res) => {
    try {
        const stats = await getUsageStats();
        res.json({ success: true, analytics: stats });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Config endpoint
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        config: {
            showCardStats: process.env.SHOW_CARD_STATS === 'true',
            showOnlyCardsWithImages: process.env.SHOW_ONLY_CARDS_WITH_IMAGES === 'true',
            contentUrl: process.env.CONTENT_URL || 'api.wisdom-ai.pro'
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'NeoParentz Content Delivery API',
        version: '1.0.0',
        endpoints: {
            getCard: 'GET /api/card',
            submitFeedback: 'POST /api/card/:cardId/feedback',
            getStats: 'GET /api/stats',
            health: 'GET /api/health'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
async function startServer() {
    try {
        // Connect to MongoDB first
        await connectToDatabase();

        // Setup database indexes
        await setupIndexes();

        // Pre-warm cache for instant first load
        await prewarmCache();

        // Start scheduled tasks (reindexing, etc.)
        startScheduler();

        // Start Express server
        app.listen(PORT, () => {
            console.log(`\n🚀 NeoParentz Content Delivery API`);
            console.log(`📡 Server running on http://localhost:${PORT}`);
            console.log(`🌐 CORS enabled for: ${corsOptions.origin}`);
            console.log(`\n📚 Available endpoints:`);
            console.log(`   GET  /api/card - Get a personalized content card`);
            console.log(`   POST /api/card/:id/feedback - Submit feedback`);
            console.log(`   GET  /api/stats - Get user statistics`);
            console.log(`   GET  /api/analytics - Get usage analytics`);
            console.log(`   GET  /api/health - Health check\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    const { closeDatabase } = require('./src/config/database');
    await closeDatabase();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    const { closeDatabase } = require('./src/config/database');
    await closeDatabase();
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
