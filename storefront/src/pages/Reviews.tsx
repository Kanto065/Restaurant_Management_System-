import { useState } from 'react';
import { useReviews } from '../lib/queries';
import MandalaAccent from '../components/MandalaAccent';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-brand-orange">
      {'★'.repeat(rating)}
      <span className="text-brand-cream/20">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function Reviews() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReviews(page);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;

  return (
    <div className="relative overflow-hidden">
      <MandalaAccent position="bottom-center" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl sm:text-4xl mb-1">Reviews</h1>
      {data && (
        <p className="text-brand-cream/70 mb-6">
          Average rating <Stars rating={Math.round(data.averageRating)} /> ({data.averageRating.toFixed(1)} / 5, {data.totalCount} review{data.totalCount === 1 ? '' : 's'})
        </p>
      )}

      {isLoading && <p className="text-brand-cream/70">Loading reviews...</p>}

      {data && (
        <>
          <div className="space-y-3">
            {data.reviews.map((r) => (
              <div key={r.id} className="bg-brand-cream text-brand-bg rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {r.authorName}{r.authorLocation && <span className="text-brand-bg/60 font-normal">, {r.authorLocation}</span>}
                  </p>
                  <Stars rating={r.rating} />
                </div>
                {r.comment && <p className="text-sm mt-1 text-brand-bg/80">{r.comment}</p>}
                <p className="text-xs text-brand-bg/50 mt-2">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            ))}
            {data.reviews.length === 0 && <p className="text-brand-cream/70">No reviews yet.</p>}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-brand-cream/30 text-sm disabled:opacity-30"
              >
                ‹ Prev
              </button>
              <span className="text-sm text-brand-cream/70">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-brand-cream/30 text-sm disabled:opacity-30"
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
