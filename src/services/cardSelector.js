const { getDatabase } = require('../config/database');
const { calculateFinalScore } = require('../utils/scoring');
const { ObjectId } = require('mongodb');

// In-memory cache for cards
let cardsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cards from cache or database
 */
async function getCards(query = {}) {
    const now = Date.now();

    // Check if we should filter by images
    const showOnlyWithImages = process.env.SHOW_ONLY_CARDS_WITH_IMAGES === 'true';

    // Return cached cards if still valid
    if (cardsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
        console.log('Using cached cards');
        let cards = cardsCache;

        // Apply image filter if enabled
        if (showOnlyWithImages) {
            cards = cards.filter(card => card.imageData && card.imageMimeType);
            console.log(`Filtered to ${cards.length} cards with images`);
        }

        return cards;
    }

    const db = getDatabase();
    const collection = db.collection('contentcards');

    // Add image filter to query if enabled
    if (showOnlyWithImages) {
        query.imageData = { $exists: true, $ne: null };
        query.imageMimeType = { $exists: true, $ne: null };
    }

    // Fetch cards
    const cards = await collection.find(query).toArray();

    cardsCache = cards;
    cacheTimestamp = now;
    console.log(`Cached ${cards.length} cards${showOnlyWithImages ? ' (with images only)' : ''}`);

    return cards;
}

/**
 * Select the best card for a user based on their session
 */
async function selectCard(session, options = {}) {
    try {
        // Build query filters
        const query = {};

        // Apply language filter if specified
        if (options.language) {
            query.language = options.language;
        }

        // Get all cards from cache
        const allCards = await getCards(query);

        if (allCards.length === 0) {
            return { card: null, allSeen: true };
        }

        // Filter out already delivered cards
        const unseenCards = allCards.filter(card =>
            !session.deliveredCards.includes(card._id.toString())
        );

        // If all cards have been seen, reset and allow re-showing
        let cardsToScore = unseenCards.length > 0 ? unseenCards : allCards;
        const allSeen = unseenCards.length === 0;

        // Score all candidates
        const scoredCards = cardsToScore.map(card => ({
            card,
            score: calculateFinalScore(card, session)
        }));

        // Sort by score (highest first)
        scoredCards.sort((a, b) => b.score - a.score);

        // Return the top card
        return {
            card: scoredCards[0].card,
            allSeen,
            score: scoredCards[0].score
        };

    } catch (error) {
        console.error('Error selecting card:', error);
        throw error;
    }
}

/**
 * Get card by ID (for feedback)
 */
async function getCardById(cardId) {
    const db = getDatabase();
    const collection = db.collection('contentcards');

    try {
        const card = await collection.findOne({ _id: new ObjectId(cardId) });
        return card;
    } catch (error) {
        console.error('Error getting card by ID:', error);
        return null;
    }
}

/**
 * Get statistics about available cards
 */
async function getCardStats(session) {
    const db = getDatabase();
    const collection = db.collection('contentcards');

    try {
        const totalCards = await collection.countDocuments();
        const seenCards = session.deliveredCards.length;
        const percentComplete = totalCards > 0 ? (seenCards / totalCards) * 100 : 0;

        return {
            totalAvailable: totalCards,
            totalSeen: seenCards,
            percentageComplete: parseFloat(percentComplete.toFixed(1))
        };
    } catch (error) {
        console.error('Error getting card stats:', error);
        return {
            totalAvailable: 0,
            totalSeen: 0,
            percentageComplete: 0
        };
    }
}

/**
 * Prewarm the cache with all cards
 */
async function prewarmCache() {
    await getCards();
    console.log('✓ Card cache prewarmed');
}

module.exports = {
    selectCard,
    getCardById,
    getCardStats,
    prewarmCache
};
