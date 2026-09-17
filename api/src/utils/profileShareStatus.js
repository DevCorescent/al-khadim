const TRACK = ['SENT', 'VIEWED', 'DOWNLOADED'];
const DECISION = ['SHORTLISTED', 'REJECTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED'];

function nextStatus(current, incoming) {
  if (current === 'WITHDRAWN') return current;
  if (DECISION.includes(incoming)) return incoming;
  if (DECISION.includes(current)) return current;
  return TRACK.indexOf(incoming) > TRACK.indexOf(current) ? incoming : current;
}

module.exports = { nextStatus, TRACK, DECISION };
