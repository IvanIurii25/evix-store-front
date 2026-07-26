// Cross-island moderation sync: the admin ReviewsQueue dispatches this on the
// window after approve/reject/delete of a pending review, carrying the fresh
// pending count; the AdminLayout nav badge listens and updates its text/visibility.
// The count is resolved by the island (typed client → correct API base + creds),
// so the layout's inline listener never has to know the API origin.
export const REVIEWS_MODERATED = 'reviews:moderated';

export function notifyReviewsModerated(count: number): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(REVIEWS_MODERATED, { detail: { count } }),
    );
  }
}
