// Ported from api/src/utils/profileShareStatus.js
export const TRACK = ['SENT', 'VIEWED', 'DOWNLOADED'];
export const DECISION = ['SHORTLISTED', 'REJECTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED'];

/** Tracking statuses only move forward; a decision always wins over tracking; WITHDRAWN is final. */
export function nextStatus<T extends string>(current: T, incoming: T): T {
  if (current === 'WITHDRAWN') return current;
  if (DECISION.includes(incoming)) return incoming;
  if (DECISION.includes(current)) return current;
  return TRACK.indexOf(incoming) > TRACK.indexOf(current) ? incoming : current;
}
