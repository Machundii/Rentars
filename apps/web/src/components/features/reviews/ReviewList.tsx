'use client';

import { useState } from 'react';
import StarRating from './StarRating';

export interface ReviewItem {
  id: string;
  reviewer_id: string;
  rating: number;
  comment?: string;
  host_response?: string;
  host_response_at?: string;
  created_at?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
}

interface ReviewListProps {
  reviews: ReviewItem[];
  averageRating?: number;
  currentUserId?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ReviewList({ reviews, averageRating = 0, currentUserId }: ReviewListProps) {
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  async function handleFlag(reviewId: string) {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/reviews/${reviewId}/flag`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setFlagged((prev) => new Set([...prev, reviewId]));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold">{averageRating.toFixed(1)}</span>
        <div>
          <StarRating rating={Math.round(averageRating)} size={18} />
          <p className="text-sm text-gray-500">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-gray-500">No reviews yet.</p>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className="border-t pt-4">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {review.reviewer_avatar ? (
                  <img src={review.reviewer_avatar} alt={review.reviewer_name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                    {(review.reviewer_name ?? 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="font-semibold text-sm">{review.reviewer_name ?? 'Anonymous'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                </span>
                {currentUserId && currentUserId !== review.reviewer_id && (
                  <button
                    onClick={() => handleFlag(review.id)}
                    disabled={flagged.has(review.id)}
                    className="text-xs text-gray-400 hover:text-red-500 disabled:text-gray-300"
                    title="Report this review"
                  >
                    {flagged.has(review.id) ? 'Reported' : 'Report'}
                  </button>
                )}
              </div>
            </div>
            <StarRating rating={review.rating} size={14} />
            {review.comment && <p className="text-gray-700 mt-1 text-sm">{review.comment}</p>}
            {review.host_response && (
              <div className="mt-2 ml-4 pl-3 border-l-2 border-gray-200">
                <p className="text-xs font-semibold text-gray-600">Host response</p>
                <p className="text-sm text-gray-700">{review.host_response}</p>
                {review.host_response_at && (
                  <p className="text-xs text-gray-400">{new Date(review.host_response_at).toLocaleDateString()}</p>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
