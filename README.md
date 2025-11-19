# NeoParentz Content Delivery Webapp

A personalized content delivery system that serves unique, relevant content cards to users using cookie-based tracking. Each user receives one card per request, with intelligent personalization based on their reading history.

## Features

- **Unique Card Delivery**: Guarantees no duplicate cards until all 171 cards have been seen
- **Personalization**: Multi-factor scoring algorithm that learns from user preferences
- **Cookie-Based Tracking**: No authentication required - all state stored in encrypted cookies
- **Privacy-First**: Zero personal data collection, all tracking client-side
- **RESTful API**: Simple JSON API for easy integration
- **Web Interface**: Beautiful, responsive web UI for immediate use

## Quick Start

### Prerequisites

- Node.js 14+
- MongoDB database with `contentcards` collection
- `.env` file with `MONGO_URI` configured

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# For development with auto-reload
npm run dev
```

The server will start on `http://localhost:3000`

### Access the Web Interface

Open your browser to `http://localhost:3000` to see the beautiful web interface.

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Endpoints

#### 1. Get a Personalized Card

```http
GET /api/card
```

**Query Parameters:**
- `language` (optional): Filter cards by language

**Response:**
```json
{
  "success": true,
  "card": {
    "_id": "688588bb6af1115bc950a9a7",
    "headline": "Card Title",
    "subheadline": "Card Subtitle",
    "byline": "Author Name",
    "body": "Full markdown content...",
    "reader_type": "professional",
    "reading_length": "long",
    "content_type": "analysis",
    "language": "English",
    "createdAt": "2025-07-27T02:02:35.481Z",
    "imageData": null,
    "imageMimeType": null
  },
  "meta": {
    "totalAvailable": 171,
    "totalSeen": 1,
    "percentageComplete": 0.6
  }
}
```

**When all cards have been seen:**
```json
{
  "success": true,
  "card": { ... },
  "meta": {
    "totalAvailable": 171,
    "totalSeen": 171,
    "percentageComplete": 100.0,
    "allSeen": true,
    "message": "You've seen all cards! Here's a recommended re-read."
  }
}
```

#### 2. Submit Feedback

```http
POST /api/card/:cardId/feedback
```

**Request Body:**
```json
{
  "action": "like" | "dislike" | "skip"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback recorded: like"
}
```

#### 3. Get User Statistics

```http
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalAvailable": 171,
    "totalSeen": 5,
    "percentageComplete": 2.9,
    "totalLikes": 2,
    "totalClicks": 5,
    "lastSeen": "2025-11-19T04:05:07.755Z",
    "preferredTypes": {
      "article": 3,
      "analysis": 2
    },
    "readingLengths": {
      "long": 4,
      "medium": 1
    },
    "languages": ["en", "English"]
  }
}
```

#### 4. Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-19T04:04:56.770Z"
}
```

## Personalization Algorithm

The system uses a multi-factor relevance scoring algorithm:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Uniqueness** | 40% | Cards not yet seen get maximum points |
| **Recency** | 20% | Newer content scored higher |
| **Type Match** | 20% | Matches user's content_type preference history |
| **Length Match** | 10% | Matches user's reading_length preference |
| **Language Match** | 10% | Matches user's language preferences |

**Cold Start Strategy:**
- New users (< 5 cards seen) get boosted recent/popular content
- System learns preferences from first 5-10 interactions
- Gradually shifts from exploration to personalized exploitation

## Cookie Management

### Cookie Details

- **Name**: `neoparentz_session`
- **Max Age**: 90 days
- **Security**: HttpOnly, Secure (in production), SameSite=Strict
- **Encryption**: AES-256-CBC using JWT_SECRET as key
- **Max Size**: ~4KB (browser limit safe)

### Cookie Rotation

When the cookie approaches size limits:
- Keeps last 50 delivered card IDs
- Preserves all liked cards
- Ensures continued uniqueness tracking

### Cookie Structure

```javascript
{
  deliveredCards: ["cardId1", "cardId2", ...],  // Max ~100, then rotates
  userProfile: {
    preferredTypes: { "article": 5, "analysis": 3 },
    readingLengths: { "long": 6, "medium": 2 },
    languages: ["en", "English"],
    lastSeen: "2025-11-19T04:05:07.755Z"
  },
  interactions: {
    likes: ["cardId1", "cardId2"],
    clicks: 8
  }
}
```

## Project Structure

```
NeoParentz/
├── .env                    # Environment configuration
├── server.js              # Main Express application
├── package.json
├── src/
│   ├── config/
│   │   └── database.js    # MongoDB connection
│   ├── controllers/
│   │   └── cardController.js  # API request handlers
│   ├── services/
│   │   ├── cardSelector.js    # Card selection algorithm
│   │   └── cookieManager.js   # Cookie encryption/management
│   ├── middleware/
│   └── utils/
│       └── scoring.js     # Relevance scoring functions
├── public/
│   └── index.html         # Web interface
└── tests/                 # Test files (to be added)
```

## Environment Variables

Required variables in `.env`:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://...

# Security
JWT_SECRET=your_secret_key_here

# Server Configuration
PORT=3000                           # Optional, defaults to 3000
NODE_ENV=development                # or 'production'

# CORS
CORS_ORIGIN=*                       # Or specific domain
```

## Security Features

1. **Cookie Encryption**: All session data encrypted with AES-256
2. **Rate Limiting**: 100 requests/hour per IP
3. **Helmet.js**: Security headers for Express
4. **CORS**: Configurable cross-origin access
5. **No PII Storage**: Zero personal information collected

## Testing

### Manual Testing with curl

```bash
# Get a card (saves cookie)
curl -c cookies.txt http://localhost:3000/api/card

# Get another card (uses cookie)
curl -b cookies.txt -c cookies.txt http://localhost:3000/api/card

# Check statistics
curl -b cookies.txt http://localhost:3000/api/stats

# Submit feedback
curl -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"like"}' \
  http://localhost:3000/api/card/CARD_ID/feedback

# Health check
curl http://localhost:3000/api/health
```

### Using the Web Interface

1. Open `http://localhost:3000` in your browser
2. Click "Get Next Card" to receive a personalized card
3. Click "❤ Like" to record your preference
4. Watch your progress stats update in real-time

## Performance

- **API Response Time**: < 200ms average
- **Database Queries**: Optimized with indexes on `_id`, `createdAt`, `content_type`, `language`
- **Cookie Size**: Automatically managed, never exceeds 4KB
- **Scalability**: Stateless design allows horizontal scaling

## Future Enhancements (Roadmap)

**Phase 2: Enhanced Personalization**
- [ ] Add A/B testing for different scoring algorithms
- [ ] Implement machine learning for better recommendations
- [ ] Add time-of-day personalization

**Phase 3: Analytics**
- [ ] Admin dashboard for content performance
- [ ] Anonymous usage analytics
- [ ] Content gap analysis

**Phase 4: Advanced Features**
- [ ] Multi-language content translation
- [ ] Social sharing capabilities
- [ ] Content collections/playlists

## Troubleshooting

### Cookie Not Persisting

**Issue**: Cards repeat or stats reset

**Solution**:
- Ensure your client sends `credentials: 'include'` in fetch requests
- Check that browser allows cookies from localhost
- Verify `CORS_ORIGIN` is correctly configured

### MongoDB Connection Errors

**Issue**: Server fails to start with MongoDB error

**Solution**:
- Verify `MONGO_URI` in `.env` is correct
- Check network connectivity to MongoDB Atlas
- Ensure IP address is whitelisted in Atlas

### All Cards Showing as "Seen"

**Issue**: System says all cards seen but you haven't seen them

**Solution**:
- Clear cookies in browser (or delete `cookies.txt` for curl)
- This resets your session

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Support

For issues or questions, please open an issue on the repository.

---

**Built with ❤️ for NeoParentz**
