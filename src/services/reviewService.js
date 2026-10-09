import { dataStore } from "./dataStore";
// Service for managing guest reviews, category scores, AI responses, and channels

const STORAGE_KEY = 'pms_reviews_v1';

const DEFAULT_REVIEWS = [
  {
    id: 'rev_101',
    guestName: 'Sarah Jenkins',
    roomNumber: '104',
    channel: 'Google Reviews',
    channelCode: 'google',
    rating: 5,
    date: '2026-09-24T14:30:00Z',
    sentiment: 'Positive',
    comment: 'Exceptional stay! Check-in was super smooth, and the front desk staff was very welcoming. Room 104 was spotless and very quiet. Will definitely return next month!',
    categories: { cleanliness: 5, staff: 5, comfort: 5, wifi: 5, value: 5 },
    reply: {
      text: 'Dear Sarah, thank you so much for your wonderful review! We are thrilled to hear you enjoyed your spotless room and smooth check-in. Looking forward to welcoming you back next month!',
      repliedAt: '2026-09-24T16:00:00Z',
      repliedBy: 'General Manager'
    },
    status: 'replied'
  },
  {
    id: 'rev_102',
    guestName: 'Michael Chang',
    roomNumber: '208',
    channel: 'Booking.com',
    channelCode: 'booking',
    rating: 4,
    date: '2026-09-23T11:15:00Z',
    sentiment: 'Positive',
    comment: 'Great location near downtown and very comfortable bed. Wi-Fi was fast for work. Only minor note was that breakfast could have a few more warm options.',
    categories: { cleanliness: 5, staff: 4, comfort: 5, wifi: 5, value: 4 },
    reply: null,
    status: 'pending'
  },
  {
    id: 'rev_103',
    guestName: 'David Miller',
    roomNumber: '312',
    channel: 'Expedia',
    channelCode: 'expedia',
    rating: 2,
    date: '2026-09-22T09:45:00Z',
    sentiment: 'Critical',
    comment: 'The air conditioning in Room 312 was making a rattling noise at night which made it hard to sleep. Staff was polite when reported, but AC needs maintenance.',
    categories: { cleanliness: 4, staff: 4, comfort: 2, wifi: 4, value: 3 },
    reply: null,
    status: 'pending'
  },
  {
    id: 'rev_104',
    guestName: 'Elena Rostova',
    roomNumber: '101',
    channel: 'TripAdvisor',
    channelCode: 'tripadvisor',
    rating: 5,
    date: '2026-09-21T18:20:00Z',
    sentiment: 'Positive',
    comment: 'Beautiful boutique hotel! The room decor is elegant and modern. Highly recommend for business travelers and couples. 5 stars all the way.',
    categories: { cleanliness: 5, staff: 5, comfort: 5, wifi: 5, value: 5 },
    reply: {
      text: 'Thank you Elena for the fantastic review! We are delighted you enjoyed our modern decor and hospitality. See you again soon!',
      repliedAt: '2026-09-21T20:10:00Z',
      repliedBy: 'Front Desk Lead'
    },
    status: 'replied'
  },
  {
    id: 'rev_105',
    guestName: 'Robert Vance',
    roomNumber: '215',
    channel: 'Direct Post-Stay Survey',
    channelCode: 'direct',
    rating: 5,
    date: '2026-09-20T10:00:00Z',
    sentiment: 'Positive',
    comment: 'Self check-in kiosk and digital key worked flawlessly! Clean towels and great coffee in the lobby. Keep up the great service.',
    categories: { cleanliness: 5, staff: 5, comfort: 5, wifi: 5, value: 5 },
    reply: null,
    status: 'pending'
  }
];

export function getReviews() {
  if (typeof dataStore === "undefined") return DEFAULT_REVIEWS;
  try {
    const raw = dataStore.getItem(STORAGE_KEY);
    if (!raw) {
      dataStore.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_REVIEWS));
      return DEFAULT_REVIEWS;
    }
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_REVIEWS;
  }
}

export function saveReviews(reviews) {
  if (typeof dataStore === "undefined") return;
  try {
    dataStore.setItem(STORAGE_KEY, JSON.stringify(reviews));
  } catch (err) {
    console.error('Error saving reviews:', err);
  }
}

export function replyToReview(reviewId, replyText, repliedBy = 'Hotel Management') {
  const reviews = getReviews();
  const updated = reviews.map((r) => {
    if (r.id === reviewId) {
      return {
        ...r,
        status: 'replied',
        reply: {
          text: replyText,
          repliedAt: new Date().toISOString(),
          repliedBy
        }
      };
    }
    return r;
  });
  saveReviews(updated);
  return updated;
}

export function addReview(newReviewData) {
  const reviews = getReviews();
  const reviewObj = {
    id: `rev_${Date.now()}`,
    guestName: newReviewData.guestName || 'Guest',
    roomNumber: newReviewData.roomNumber || '101',
    channel: newReviewData.channel || 'Direct Post-Stay Survey',
    channelCode: newReviewData.channelCode || 'direct',
    rating: Number(newReviewData.rating) || 5,
    date: new Date().toISOString(),
    sentiment: newReviewData.rating >= 4 ? 'Positive' : newReviewData.rating === 3 ? 'Constructive' : 'Critical',
    comment: newReviewData.comment || '',
    categories: newReviewData.categories || { cleanliness: 5, staff: 5, comfort: 5, wifi: 5, value: 5 },
    reply: null,
    status: 'pending'
  };
  const updated = [reviewObj, ...reviews];
  saveReviews(updated);
  return updated;
}

export function generateAIReply(review, tone = 'warm') {
  if (!review) return '';
  const guest = review.guestName || 'Guest';
  const rating = review.rating || 5;

  if (rating >= 4) {
    if (tone === 'warm') {
      return `Dear ${guest},\n\nThank you so much for taking the time to share your wonderful ${rating}-star review! We are delighted to hear that you had an enjoyable stay with us. Your kind words mean a lot to our team, and we look forward to welcoming you back again soon!\n\nWarm regards,\nHotel Management`;
    } else if (tone === 'executive') {
      return `Dear ${guest},\n\nWe sincerely appreciate your ${rating}-star feedback regarding your stay. Providing top-tier hospitality is our highest priority, and we look forward to hosting you again.\n\nBest regards,\nGeneral Manager`;
    } else {
      return `Hi ${guest},\n\nThanks a million for the great ${rating}-star review! We are so glad you loved your room and our service. Safe travels and hope to see you again soon!\n\nCheers,\nFront Desk Team`;
    }
  } else {
    if (tone === 'solution') {
      return `Dear ${guest},\n\nThank you for bringing your concerns to our attention regarding your recent stay. We sincerely apologize for the inconvenience you experienced. Our engineering and housekeeping teams have been notified to ensure this issue is promptly resolved. We would love the opportunity to welcome you back for a seamless experience.\n\nSincerely,\nGeneral Manager`;
    } else if (tone === 'executive') {
      return `Dear ${guest},\n\nWe apologize that your recent stay did not meet expectations. We take all feedback seriously and have shared your comments with our operations leaders to address these items immediately.\n\nRegards,\nHotel Management`;
    } else {
      return `Dear ${guest},\n\nThank you for sharing your experience. We are sorry to hear about the issues you encountered. Please feel free to reach out to us directly so we can make things right on your next visit.\n\nWarmly,\nGuest Relations`;
    }
  }
}

export function getReviewKPIs(reviewsList) {
  const list = reviewsList || getReviews();
  if (!list || list.length === 0) {
    return { avgRating: '0.0', total: 0, responseRate: '0%', nps: '+0', pendingCount: 0 };
  }

  const total = list.length;
  const sumRating = list.reduce((acc, r) => acc + Number(r.rating || 0), 0);
  const avgRating = (sumRating / total).toFixed(1);

  const repliedCount = list.filter((r) => r.status === 'replied').length;
  const responseRate = `${Math.round((repliedCount / total) * 100)}%`;
  const pendingCount = total - repliedCount;

  // NPS Calculation (% Promoters [5] - % Detractors [1-3])
  const promoters = list.filter((r) => r.rating === 5).length;
  const detractors = list.filter((r) => r.rating <= 3).length;
  const npsScore = Math.round(((promoters - detractors) / total) * 100);
  const nps = npsScore >= 0 ? `+${npsScore}` : `${npsScore}`;

  return { avgRating, total, responseRate, nps, pendingCount };
}

export function getCategoryScores(reviewsList) {
  const list = reviewsList || getReviews();
  if (!list || list.length === 0) {
    return { cleanliness: '5.0', staff: '5.0', comfort: '5.0', wifi: '5.0', value: '5.0' };
  }

  const totals = { cleanliness: 0, staff: 0, comfort: 0, wifi: 0, value: 0 };
  let count = 0;

  list.forEach((r) => {
    if (r.categories) {
      totals.cleanliness += Number(r.categories.cleanliness || 5);
      totals.staff += Number(r.categories.staff || 5);
      totals.comfort += Number(r.categories.comfort || 5);
      totals.wifi += Number(r.categories.wifi || 5);
      totals.value += Number(r.categories.value || 5);
      count++;
    }
  });

  if (count === 0) return { cleanliness: '5.0', staff: '5.0', comfort: '5.0', wifi: '5.0', value: '5.0' };

  return {
    cleanliness: (totals.cleanliness / count).toFixed(1),
    staff: (totals.staff / count).toFixed(1),
    comfort: (totals.comfort / count).toFixed(1),
    wifi: (totals.wifi / count).toFixed(1),
    value: (totals.value / count).toFixed(1)
  };
}
