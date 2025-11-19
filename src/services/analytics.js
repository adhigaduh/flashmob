const { getDatabase } = require('../config/database');

/**
 * Track a card view event
 */
async function trackCardView(cardId, sessionId) {
    try {
        const db = getDatabase();
        const collection = db.collection('analytics');

        await collection.insertOne({
            type: 'view',
            cardId: cardId,
            sessionId: sessionId,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error tracking card view:', error);
    }
}

/**
 * Track a feedback event (like, dislike, skip)
 */
async function trackFeedback(cardId, sessionId, action) {
    try {
        const db = getDatabase();
        const collection = db.collection('analytics');

        await collection.insertOne({
            type: 'feedback',
            action: action,
            cardId: cardId,
            sessionId: sessionId,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error tracking feedback:', error);
    }
}

/**
 * Track a share event
 */
async function trackShare(cardId, sessionId) {
    try {
        const db = getDatabase();
        const collection = db.collection('analytics');

        await collection.insertOne({
            type: 'share',
            cardId: cardId,
            sessionId: sessionId,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error tracking share:', error);
    }
}

/**
 * Get comprehensive usage statistics
 */
async function getUsageStats() {
    try {
        const db = getDatabase();
        const analyticsCollection = db.collection('analytics');
        const cardsCollection = db.collection('contentcards');

        // Breadth metrics
        const totalCards = await cardsCollection.countDocuments();
        const viewedCardsCount = await analyticsCollection.distinct('cardId', { type: 'view' });
        const breadthPercentage = ((viewedCardsCount.length / totalCards) * 100).toFixed(1);

        // Depth metrics
        const totalViews = await analyticsCollection.countDocuments({ type: 'view' });
        const totalSessions = (await analyticsCollection.distinct('sessionId')).length;
        const avgViewsPerSession = totalSessions > 0 ? (totalViews / totalSessions).toFixed(1) : 0;

        // Popularity metrics - Most liked cards
        const mostLiked = await analyticsCollection.aggregate([
            { $match: { type: 'feedback', action: 'like' } },
            { $group: { _id: '$cardId', likes: { $sum: 1 } } },
            { $sort: { likes: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Popularity metrics - Most viewed cards
        const mostViewed = await analyticsCollection.aggregate([
            { $match: { type: 'view' } },
            { $group: { _id: '$cardId', views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Popularity metrics - Most shared cards
        const mostShared = await analyticsCollection.aggregate([
            { $match: { type: 'share' } },
            { $group: { _id: '$cardId', shares: { $sum: 1 } } },
            { $sort: { shares: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Engagement metrics
        const totalLikes = await analyticsCollection.countDocuments({ type: 'feedback', action: 'like' });
        const totalDislikes = await analyticsCollection.countDocuments({ type: 'feedback', action: 'dislike' });
        const totalSkips = await analyticsCollection.countDocuments({ type: 'feedback', action: 'skip' });
        const totalShares = await analyticsCollection.countDocuments({ type: 'share' });

        const engagementRate = totalViews > 0
            ? (((totalLikes + totalDislikes + totalSkips) / totalViews) * 100).toFixed(1)
            : 0;

        return {
            breadth: {
                totalCards,
                viewedCards: viewedCardsCount.length,
                breadthPercentage: parseFloat(breadthPercentage)
            },
            depth: {
                totalViews,
                totalSessions,
                avgViewsPerSession: parseFloat(avgViewsPerSession)
            },
            popularity: {
                mostLiked,
                mostViewed,
                mostShared
            },
            engagement: {
                totalLikes,
                totalDislikes,
                totalSkips,
                totalShares,
                engagementRate: parseFloat(engagementRate)
            }
        };
    } catch (error) {
        console.error('Error getting usage stats:', error);
        return null;
    }
}

/**
 * Get enriched card details for analytics
 */
async function enrichCardData(cardIds) {
    try {
        const db = getDatabase();
        const { ObjectId } = require('mongodb');

        const cards = await db.collection('contentcards').find({
            _id: { $in: cardIds.map(id => new ObjectId(id)) }
        }).toArray();

        return cards.map(card => ({
            id: card._id.toString(),
            headline: card.headline,
            contentType: card.content_type,
            readerType: card.reader_type
        }));
    } catch (error) {
        console.error('Error enriching card data:', error);
        return [];
    }
}

module.exports = {
    trackCardView,
    trackFeedback,
    trackShare,
    getUsageStats,
    enrichCardData
};
