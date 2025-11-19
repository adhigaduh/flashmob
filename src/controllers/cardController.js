const { selectCard, getCardById, getCardStats } = require('../services/cardSelector');
const {
    getSession,
    saveSession,
    addDeliveredCard,
    updateProfile,
    recordFeedback
} = require('../services/cookieManager');
const { trackCardView, trackFeedback, trackShare } = require('../services/analytics');

/**
 * GET /api/card
 * Deliver a single personalized card
 */
async function deliverCard(req, res) {
    try {
        // Get or create session from cookie
        const session = getSession(req);

        // Get language preference from query or session
        const language = req.query.language || null;

        // Select the best card
        const result = await selectCard(session, { language });

        if (!result.card) {
            return res.status(404).json({
                success: false,
                error: 'No cards available'
            });
        }

        // Update session with the delivered card
        addDeliveredCard(session, result.card._id);
        updateProfile(session, result.card);

        // Save updated session to cookie
        saveSession(res, session);

        // Track card view for analytics
        await trackCardView(result.card._id.toString(), session.sessionId || 'anonymous');

        // Get stats
        const stats = await getCardStats(session);

        // Prepare response
        const response = {
            success: true,
            card: {
                _id: result.card._id,
                headline: result.card.headline,
                subheadline: result.card.subheadline,
                byline: result.card.byline,
                body: result.card.body,
                reader_type: result.card.reader_type,
                reading_length: result.card.reading_length,
                content_type: result.card.content_type,
                language: result.card.language,
                createdAt: result.card.createdAt,
                imageData: result.card.imageData,
                imageMimeType: result.card.imageMimeType
            },
            meta: {
                ...stats
            }
        };

        // Add allSeen flag if applicable
        if (result.allSeen) {
            response.meta.allSeen = true;
            response.meta.message = "You've seen all cards! Here's a recommended re-read.";
        }

        return res.json(response);

    } catch (error) {
        console.error('Error delivering card:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

/**
 * POST /api/card/:cardId/feedback
 * Record user feedback (like, dislike, skip)
 */
async function submitFeedback(req, res) {
    try {
        const { cardId } = req.params;
        const { action } = req.body;

        // Validate action
        if (!['like', 'dislike', 'skip'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action. Must be: like, dislike, or skip'
            });
        }

        // Verify card exists
        const card = await getCardById(cardId);
        if (!card) {
            return res.status(404).json({
                success: false,
                error: 'Card not found'
            });
        }

        // Get session and update feedback
        const session = getSession(req);
        recordFeedback(session, cardId, action);

        // Save updated session
        saveSession(res, session);

        // Track feedback for analytics
        await trackFeedback(cardId, session.sessionId || 'anonymous', action);

        return res.json({
            success: true,
            message: `Feedback recorded: ${action}`
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

/**
 * GET /api/stats
 * Get user statistics
 */
async function getUserStats(req, res) {
    try {
        const session = getSession(req);
        const stats = await getCardStats(session);

        return res.json({
            success: true,
            stats: {
                ...stats,
                totalLikes: session.interactions.likes.length,
                totalClicks: session.interactions.clicks,
                lastSeen: session.userProfile.lastSeen,
                preferredTypes: session.userProfile.preferredTypes,
                readingLengths: session.userProfile.readingLengths,
                languages: session.userProfile.languages
            }
        });

    } catch (error) {
        console.error('Error getting user stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

/**
 * POST /api/card/:cardId/later
 * Mark card to show later (remove from delivered list)
 */
async function showMeLater(req, res) {
    try {
        const { cardId } = req.params;

        // Verify card exists
        const card = await getCardById(cardId);
        if (!card) {
            return res.status(404).json({
                success: false,
                error: 'Card not found'
            });
        }

        // Get session and remove card from delivered list
        const session = getSession(req);

        // Remove the card from deliveredCards array
        session.deliveredCards = session.deliveredCards.filter(
            id => id !== cardId.toString()
        );

        // Save updated session
        saveSession(res, session);

        return res.json({
            success: true,
            message: 'Card marked to show later'
        });

    } catch (error) {
        console.error('Error marking card for later:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

/**
 * POST /api/reset
 * Reset user session (clear all history)
 */
async function resetSession(req, res) {
    try {
        // Clear the cookie by setting it to expire in the past
        res.clearCookie('neoparentz_session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return res.json({
            success: true,
            message: 'Session reset successfully'
        });

    } catch (error) {
        console.error('Error resetting session:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

module.exports = {
    deliverCard,
    submitFeedback,
    getUserStats,
    showMeLater,
    resetSession
};
