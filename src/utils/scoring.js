/**
 * Calculate relevance score for a card based on user session
 *
 * Scoring weights:
 * - Uniqueness: 40% (not yet seen)
 * - Recency: 20% (newer content)
 * - Type Match: 20% (matches user's content_type history)
 * - Length Match: 10% (matches user's reading_length preference)
 * - Language Match: 10% (matches user's language preference)
 */

function calculateRelevanceScore(card, session) {
    let score = 0;

    // 1. Uniqueness Score (40 points max)
    // If card not yet delivered, full points
    const isUnique = !session.deliveredCards.includes(card._id.toString());
    score += isUnique ? 40 : 0;

    // 2. Recency Score (20 points max)
    // More recent cards get higher scores
    if (card.createdAt) {
        const now = new Date();
        const cardDate = new Date(card.createdAt);
        const daysSinceCreation = (now - cardDate) / (1000 * 60 * 60 * 24);

        // Score decays over time: max 20 points for cards <7 days old
        const recencyScore = Math.max(0, 20 - (daysSinceCreation / 7) * 2);
        score += Math.min(20, recencyScore);
    }

    // 3. Content Type Match (20 points max)
    if (card.content_type && session.userProfile.preferredTypes) {
        const typeCount = session.userProfile.preferredTypes[card.content_type] || 0;
        const totalInteractions = Object.values(session.userProfile.preferredTypes).reduce((a, b) => a + b, 0) || 1;
        const typePreference = typeCount / totalInteractions;

        score += typePreference * 20;
    }

    // 4. Reading Length Match (10 points max)
    if (card.reading_length && session.userProfile.readingLengths) {
        const lengthCount = session.userProfile.readingLengths[card.reading_length] || 0;
        const totalInteractions = Object.values(session.userProfile.readingLengths).reduce((a, b) => a + b, 0) || 1;
        const lengthPreference = lengthCount / totalInteractions;

        score += lengthPreference * 10;
    }

    // 5. Language Match (10 points max)
    if (card.language && session.userProfile.languages) {
        const languageMatch = session.userProfile.languages.includes(card.language);
        score += languageMatch ? 10 : 0;
    }

    // Add small random factor (±5%) to avoid predictability
    const randomFactor = (Math.random() - 0.5) * 5;
    score += randomFactor;

    return Math.max(0, score);
}

/**
 * Cold start strategy for new users
 * Returns priority score boost for popular/recent content
 */
function getColdStartBoost(card, session) {
    // If user has seen fewer than 5 cards, prioritize recent content
    const isNewUser = session.interactions.clicks < 5;

    if (!isNewUser) {
        return 0;
    }

    // Boost recent content for new users
    if (card.createdAt) {
        const now = new Date();
        const cardDate = new Date(card.createdAt);
        const daysSinceCreation = (now - cardDate) / (1000 * 60 * 60 * 24);

        if (daysSinceCreation < 30) {
            return 10; // Extra boost for recent content
        }
    }

    // Boost cards with likes (if available)
    if (card.likes && card.likes > 0) {
        return Math.min(10, card.likes / 10);
    }

    return 0;
}

/**
 * Calculate final score with all factors
 */
function calculateFinalScore(card, session) {
    const baseScore = calculateRelevanceScore(card, session);
    const coldStartBoost = getColdStartBoost(card, session);

    return baseScore + coldStartBoost;
}

module.exports = {
    calculateRelevanceScore,
    getColdStartBoost,
    calculateFinalScore
};
