const express = require('express');
const router = express.Router();

const sanitizeInput = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

router.post('/feedback', async (req, res) => {
  try {
    const { rating, comment, page } = req.body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be a number between 1 and 5'
      });
    }

    const validPages = ['contact', 'order-success'];
    if (!page || !validPages.includes(page)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page identifier'
      });
    }

    const sanitizedComment = sanitizeInput(comment).substring(0, 500);

    const feedbackDocument = {
      rating: Math.floor(rating),
      comment: sanitizedComment,
      page,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'] || null,
      sessionId: req.session?.id || null,
      userId: req.session?.user?._id || null
    };

    const result = await req.db.collection('Feedback').insertOne(feedbackDocument);

    if (result.acknowledged) {
      return res.status(201).json({
        success: true,
        message: 'Thank you for your feedback!',
        data: { id: result.insertedId }
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to save feedback'
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while submitting feedback'
    });
  }
});

router.get('/feedback/stats', async (req, res) => {
  try {
    if (!req.session?.user || !['admin', 'staff'].includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const stats = await req.db.collection('Feedback').aggregate([
      {
        $group: {
          _id: '$page',
          totalResponses: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: {
            $push: '$rating'
          }
        }
      }
    ]).toArray();

    const ratingDistribution = await req.db.collection('Feedback').aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    return res.json({
      success: true,
      data: {
        byPage: stats,
        ratingDistribution
      }
    });

  } catch (error) {
    console.error('Feedback stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve feedback statistics'
    });
  }
});

module.exports = router;
