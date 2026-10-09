import { dataStore } from "../services/dataStore";
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ReviewManagement from '../pages/frontdesk/ReviewManagement';
import { 
  getReviews, 
  getReviewKPIs, 
  getCategoryScores, 
  generateAIReply, 
  replyToReview 
} from '../services/reviewService';

describe('Review Management Module', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  it('calculates KPIs correctly for review list', () => {
    const reviews = getReviews();
    const kpis = getReviewKPIs(reviews);

    expect(kpis.total).toBe(5);
    expect(Number(kpis.avgRating)).toBeGreaterThan(3.5);
    expect(kpis.responseRate).toContain('%');
  });

  it('calculates category performance scores correctly', () => {
    const reviews = getReviews();
    const scores = getCategoryScores(reviews);

    expect(scores.cleanliness).toBeDefined();
    expect(scores.staff).toBeDefined();
    expect(scores.comfort).toBeDefined();
    expect(scores.wifi).toBeDefined();
    expect(scores.value).toBeDefined();
  });

  it('generates warm AI reply for 5-star positive review', () => {
    const review = { guestName: 'John Doe', rating: 5 };
    const reply = generateAIReply(review, 'warm');

    expect(reply).toContain('John Doe');
    expect(reply).toContain('5-star review');
  });

  it('generates solution-oriented AI reply for critical review', () => {
    const review = { guestName: 'Jane Smith', rating: 2 };
    const reply = generateAIReply(review, 'solution');

    expect(reply).toContain('Jane Smith');
    expect(reply).toContain('sincerely apologize');
  });

  it('saves reply to review and updates status to replied', () => {
    const reviews = replyToReview('rev_102', 'Thank you for your review!', 'Manager');
    const target = reviews.find((r) => r.id === 'rev_102');

    expect(target.status).toBe('replied');
    expect(target.reply.text).toBe('Thank you for your review!');
  });

  it('renders ReviewManagement page without crashing', () => {
    render(<ReviewManagement />);
    expect(screen.getByText(/Review & Reputation Management/i)).toBeTruthy();
    expect(screen.getByText(/Overall Rating/i)).toBeTruthy();
    expect(screen.getByText(/Cleanliness/i)).toBeTruthy();
  });
});
