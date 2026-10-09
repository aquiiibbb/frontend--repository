import React, { useState, useEffect, useMemo } from 'react';
import { 
  getReviews, 
  replyToReview, 
  generateAIReply, 
  getReviewKPIs, 
  getCategoryScores,
  addReview 
} from '../../services/reviewService';
import { 
  Star, 
  MessageSquare, 
  Sparkles, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ThumbsUp, 
  AlertTriangle, 
  Send, 
  User, 
  Building2, 
  Plus, 
  RefreshCw,
  Search,
  ChevronDown
} from 'lucide-react';

export default function ReviewManagement() {
  const [reviews, setReviews] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI Reply Modal State
  const [activeReviewForReply, setActiveReviewForReply] = useState(null);
  const [replyTone, setReplyTone] = useState('warm');
  const [replyText, setReplyText] = useState('');
  
  // Add Direct Survey Modal State
  const [showAddSurveyModal, setShowAddSurveyModal] = useState(false);
  const [newSurveyGuest, setNewSurveyGuest] = useState('');
  const [newSurveyRoom, setNewSurveyRoom] = useState('101');
  const [newSurveyRating, setNewSurveyRating] = useState(5);
  const [newSurveyChannel, setNewSurveyChannel] = useState('Direct Post-Stay Survey');
  const [newSurveyComment, setNewSurveyComment] = useState('');

  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = () => {
    const data = getReviews();
    setReviews(data);
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // KPIs and Category Scores
  const kpis = useMemo(() => getReviewKPIs(reviews), [reviews]);
  const catScores = useMemo(() => getCategoryScores(reviews), [reviews]);

  // Filtered Reviews List
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // Channel Filter
      if (selectedChannel !== 'all' && r.channelCode !== selectedChannel) {
        return false;
      }
      // Rating Filter
      if (selectedRating === '5' && r.rating !== 5) return false;
      if (selectedRating === '4' && r.rating !== 4) return false;
      if (selectedRating === '1-3' && r.rating > 3) return false;
      if (selectedRating === 'pending' && r.status !== 'pending') return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const guestMatch = (r.guestName || '').toLowerCase().includes(q);
        const commentMatch = (r.comment || '').toLowerCase().includes(q);
        const roomMatch = (r.roomNumber || '').toLowerCase().includes(q);
        if (!guestMatch && !commentMatch && !roomMatch) return false;
      }

      return true;
    });
  }, [reviews, selectedChannel, selectedRating, searchQuery]);

  // Open Reply Modal & Auto-Generate Reply
  const handleOpenReplyModal = (review) => {
    setActiveReviewForReply(review);
    const initialTone = review.rating >= 4 ? 'warm' : 'solution';
    setReplyTone(initialTone);
    const generated = generateAIReply(review, initialTone);
    setReplyText(generated);
  };

  // Change Tone in Reply Modal
  const handleToneChange = (tone) => {
    setReplyTone(tone);
    if (activeReviewForReply) {
      const generated = generateAIReply(activeReviewForReply, tone);
      setReplyText(generated);
    }
  };

  // Submit Reply
  const handleSendReply = (e) => {
    if (e) e.preventDefault();
    if (!activeReviewForReply || !replyText.trim()) return;

    const updated = replyToReview(activeReviewForReply.id, replyText.trim(), 'Front Desk Manager');
    setReviews(updated);
    setActiveReviewForReply(null);
    showToast('Reply published successfully to guest review!');
  };

  // Submit New Direct Survey
  const handleSaveNewSurvey = (e) => {
    if (e) e.preventDefault();
    if (!newSurveyGuest.trim() || !newSurveyComment.trim()) return;

    const channelCodeMap = {
      'Direct Post-Stay Survey': 'direct',
      'Google Reviews': 'google',
      'Booking.com': 'booking',
      'TripAdvisor': 'tripadvisor',
      'Expedia': 'expedia'
    };

    const updated = addReview({
      guestName: newSurveyGuest.trim(),
      roomNumber: newSurveyRoom.trim() || '101',
      rating: Number(newSurveyRating),
      channel: newSurveyChannel,
      channelCode: channelCodeMap[newSurveyChannel] || 'direct',
      comment: newSurveyComment.trim()
    });

    setReviews(updated);
    setShowAddSurveyModal(false);
    setNewSurveyGuest('');
    setNewSurveyComment('');
    showToast('Guest survey / review logged successfully.');
  };

  const renderStars = (rating) => {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            fill={star <= rating ? '#f59e0b' : 'none'}
            color={star <= rating ? '#f59e0b' : '#cbd5e1'}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit', color: '#0f172a' }}>
      
      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#0f172a', color: '#ffffff', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 999999, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} color="#4ade80" />
          {toastMsg}
        </div>
      )}

      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ⭐ Review &amp; Reputation Management
            <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: '20px', fontWeight: '700' }}>
              Live Channel Feed
            </span>
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>
            Monitor guest feedback across Google, TripAdvisor, Booking.com, Expedia &amp; Direct Post-Stay Surveys.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddSurveyModal(true)}
          style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={15} /> + Log Guest Survey
        </button>
      </div>

      {/* TOP KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* KPI 1: Overall Rating */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            🌟
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Overall Rating</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {kpis.avgRating} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>/ 5.0</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Reviews */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            💬
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Reviews</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
              {kpis.total} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>({kpis.pendingCount} Pending)</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Response Rate */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#dcfce7', color: '#16a34a', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Response Rate</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
              {kpis.responseRate}
            </div>
          </div>
        </div>

        {/* KPI 4: NPS Score */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#f3e8ff', color: '#9333ea', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            📈
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Net Promoter (NPS)</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
              {kpis.nps} <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>Excellent</span>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY PERFORMANCE SCORES */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📊 Hotel Category Scores (Guest Feedback Breakdown)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>🧹 Cleanliness</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{catScores.cleanliness} / 5.0</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>🛎️ Staff &amp; Courtesy</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{catScores.staff} / 5.0</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>🛏️ Comfort &amp; Bed</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{catScores.comfort} / 5.0</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>📶 Wi-Fi &amp; Amenities</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{catScores.wifi} / 5.0</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700' }}>💰 Value for Money</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{catScores.value} / 5.0</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        
        {/* CHANNEL FILTERS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginRight: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={13} /> Channel:
          </span>
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'google', label: 'Google' },
            { id: 'booking', label: 'Booking.com' },
            { id: 'tripadvisor', label: 'TripAdvisor' },
            { id: 'expedia', label: 'Expedia' },
            { id: 'direct', label: 'Direct Survey' }
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedChannel(c.id)}
              style={{
                background: selectedChannel === c.id ? '#0f172a' : '#ffffff',
                color: selectedChannel === c.id ? '#ffffff' : '#475569',
                border: '1px solid #cbd5e1',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* RATING & SEARCH */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '12.5px', fontWeight: '700', color: '#0f172a', background: '#ffffff' }}
          >
            <option value="all">All Rating Stars</option>
            <option value="5">5 Stars (Positive)</option>
            <option value="4">4 Stars</option>
            <option value="1-3">1-3 Stars (Attention Needed)</option>
            <option value="pending">Pending Reply Only</option>
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guest or keyword..."
              style={{ padding: '6px 12px 6px 30px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '12.5px', width: '200px' }}
            />
          </div>
        </div>
      </div>

      {/* REVIEWS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredReviews.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1.5px dashed #cbd5e1', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>No reviews found matching your filter criteria</div>
            <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Try switching channel tabs or clearing search query.</div>
          </div>
        ) : (
          filteredReviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              {/* CARD HEADER */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    {rev.guestName ? rev.guestName.charAt(0) : 'G'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        {rev.guestName}
                      </h3>
                      <span style={{ fontSize: '11px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontWeight: '700', color: '#475569' }}>
                        Room {rev.roomNumber || '101'}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 8px',
                          borderRadius: '4px',
                          fontWeight: '800',
                          background: rev.rating >= 4 ? '#dcfce7' : rev.rating === 3 ? '#fef3c7' : '#fee2e2',
                          color: rev.rating >= 4 ? '#166534' : rev.rating === 3 ? '#92400e' : '#991b1b'
                        }}
                      >
                        {rev.sentiment || (rev.rating >= 4 ? 'Positive' : 'Needs Attention')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                      {renderStars(rev.rating)}
                      <span>•</span>
                      <span>🌐 {rev.channel}</span>
                      <span>•</span>
                      <span>📅 {new Date(rev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {/* STATUS BADGE & REPLY BUTTON */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {rev.status === 'replied' ? (
                    <span style={{ fontSize: '11.5px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '6px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} /> Replied
                    </span>
                  ) : (
                    <span style={{ fontSize: '11.5px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '6px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> Pending Reply
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenReplyModal(rev)}
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles size={14} color="#f59e0b" /> 🤖 Auto-Generate AI Reply
                  </button>
                </div>
              </div>

              {/* GUEST COMMENT BODY */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', fontSize: '13.5px', color: '#1e293b', lineHeight: '1.5', fontWeight: '500' }}>
                "{rev.comment}"
              </div>

              {/* EXISTING REPLY SECTION IF PUBLISHED */}
              {rev.reply && (
                <div style={{ background: '#f1f5f9', borderLeft: '4px solid #0f172a', borderRadius: '0 10px 10px 0', padding: '12px 16px', marginTop: '4px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💬 Hotel Response by {rev.reply.repliedBy || 'Management'}
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                      ({new Date(rev.reply.repliedAt).toLocaleDateString()})
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.4' }}>
                    {rev.reply.text}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 🤖 AI REPLY GENERATOR MODAL */}
      {activeReviewForReply && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '600px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            
            {/* MODAL HEADER */}
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#d97706" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    🤖 AI Review Reply Generator
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                    Guest: {activeReviewForReply.guestName} ({activeReviewForReply.channel})
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setActiveReviewForReply(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSendReply} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* ORIGINAL REVIEW SUMMARY */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '12.5px', color: '#334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '800', color: '#0f172a' }}>Original Review ({renderStars(activeReviewForReply.rating)})</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Room {activeReviewForReply.roomNumber}</span>
                </div>
                <div>"{activeReviewForReply.comment}"</div>
              </div>

              {/* TONE SELECTION BUTTONS */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                  Select Response Tone Template:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'warm', label: '😊 Warm & Grateful' },
                    { id: 'solution', label: '🛠️ Professional & Solution-Oriented' },
                    { id: 'executive', label: '💼 Executive & Concise' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToneChange(t.id)}
                      style={{
                        background: replyTone === t.id ? '#0f172a' : '#ffffff',
                        color: replyTone === t.id ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* EDITABLE REPLY TEXT AREA */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                  Edit Drafted Response:
                </label>
                <textarea
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', lineHeight: '1.4', fontFamily: 'inherit' }}
                  required
                />
              </div>

              {/* MODAL FOOTER */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveReviewForReply(null)}
                  style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={14} /> Publish &amp; Post Reply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ➕ LOG DIRECT GUEST SURVEY MODAL */}
      {showAddSurveyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>⭐ Log Guest Review / Survey</h3>
              <button type="button" onClick={() => setShowAddSurveyModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSaveNewSurvey} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Guest Full Name *</label>
                <input type="text" value={newSurveyGuest} onChange={(e) => setNewSurveyGuest(e.target.value)} placeholder="e.g. John Smith" required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Room Number</label>
                  <input type="text" value={newSurveyRoom} onChange={(e) => setNewSurveyRoom(e.target.value)} placeholder="101" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Star Rating</label>
                  <select value={newSurveyRating} onChange={(e) => setNewSurveyRating(Number(e.target.value))} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: '700' }}>
                    <option value={5}>⭐⭐⭐⭐⭐ (5 Stars)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 Stars)</option>
                    <option value={3}>⭐⭐⭐ (3 Stars)</option>
                    <option value={2}>⭐⭐ (2 Stars)</option>
                    <option value={1}>⭐ (1 Star)</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Review Channel Source</label>
                <select value={newSurveyChannel} onChange={(e) => setNewSurveyChannel(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: '700' }}>
                  <option value="Direct Post-Stay Survey">Direct Post-Stay Survey</option>
                  <option value="Google Reviews">Google Reviews</option>
                  <option value="Booking.com">Booking.com</option>
                  <option value="TripAdvisor">TripAdvisor</option>
                  <option value="Expedia">Expedia</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Guest Comment / Feedback *</label>
                <textarea rows={3} value={newSurveyComment} onChange={(e) => setNewSurveyComment(e.target.value)} placeholder="Type guest feedback..." required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddSurveyModal(false)} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>Save Review</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
