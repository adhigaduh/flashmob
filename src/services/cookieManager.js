const crypto = require('crypto');

// Cookie configuration
const COOKIE_NAME = 'neoparentz_session';
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
const MAX_DELIVERED_CARDS = 100; // Maximum card IDs to store before rotation

// Encryption key (derived from JWT_SECRET for consistency)
const getEncryptionKey = () => {
    const secret = process.env.JWT_SECRET || 'm0d3rnl@nd';
    return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Initialize a new user session
 */
function createNewSession() {
    return {
        deliveredCards: [],
        userProfile: {
            preferredTypes: {},
            readingLengths: {},
            languages: ['en'],
            lastSeen: new Date().toISOString()
        },
        interactions: {
            likes: [],
            clicks: 0
        }
    };
}

/**
 * Encrypt session data before storing in cookie
 */
function encryptSession(sessionData) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);

        const jsonData = JSON.stringify(sessionData);
        let encrypted = cipher.update(jsonData, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

/**
 * Decrypt session data from cookie
 */
function decryptSession(encryptedData) {
    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * Get session from request cookies
 */
function getSession(req) {
    const encryptedSession = req.cookies[COOKIE_NAME];

    if (!encryptedSession) {
        return createNewSession();
    }

    const session = decryptSession(encryptedSession);
    return session || createNewSession();
}

/**
 * Save session to response cookies
 */
function saveSession(res, sessionData) {
    const encrypted = encryptSession(sessionData);

    if (!encrypted) {
        console.error('Failed to encrypt session');
        return false;
    }

    res.cookie(COOKIE_NAME, encrypted, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict'
    });

    return true;
}

/**
 * Add a delivered card to the session
 * Implements rotation when max limit reached
 */
function addDeliveredCard(session, cardId) {
    if (!session.deliveredCards.includes(cardId.toString())) {
        session.deliveredCards.push(cardId.toString());
    }

    // Rotate if exceeded max
    if (session.deliveredCards.length > MAX_DELIVERED_CARDS) {
        // Keep last 50 cards + all liked cards
        const likedCards = session.interactions.likes || [];
        const recentCards = session.deliveredCards.slice(-50);

        // Combine and deduplicate
        session.deliveredCards = [...new Set([...recentCards, ...likedCards])];
    }

    // Update interaction count
    session.interactions.clicks = (session.interactions.clicks || 0) + 1;
    session.userProfile.lastSeen = new Date().toISOString();

    return session;
}

/**
 * Update user profile based on card interaction
 */
function updateProfile(session, card) {
    const profile = session.userProfile;

    // Track content type preference
    if (card.content_type) {
        profile.preferredTypes[card.content_type] =
            (profile.preferredTypes[card.content_type] || 0) + 1;
    }

    // Track reading length preference
    if (card.reading_length) {
        profile.readingLengths[card.reading_length] =
            (profile.readingLengths[card.reading_length] || 0) + 1;
    }

    // Track language preference
    if (card.language && !profile.languages.includes(card.language)) {
        profile.languages.push(card.language);
    }

    return session;
}

/**
 * Record a like/feedback
 */
function recordFeedback(session, cardId, action) {
    if (action === 'like') {
        if (!session.interactions.likes.includes(cardId.toString())) {
            session.interactions.likes.push(cardId.toString());
        }
    }
    return session;
}

module.exports = {
    COOKIE_NAME,
    createNewSession,
    getSession,
    saveSession,
    addDeliveredCard,
    updateProfile,
    recordFeedback
};
