const IN_PROGRESS = 'en-progreso';
const BLOCKED = 'bloqueado';
const NEEDS_DESIGN = 'necesita-diseño';
const REMIND_AFTER_DAYS = 7;
const RELEASE_AFTER_DAYS = 14;
const REMINDER_MARK = '<!-- claim-reminder -->';
const DAY_MS = 24 * 60 * 60 * 1000;

const TAKE = ['/tomar', '/assumir', '/take'];
const RELEASE = ['/soltar', '/liberar', '/release'];

function parseCommand(body) {
  const first = String(body || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (TAKE.includes(first)) return 'take';
  if (RELEASE.includes(first)) return 'release';
  return null;
}

function daysSince(date, now) {
  return Math.floor((new Date(now).getTime() - new Date(date).getTime()) / DAY_MS);
}

function decideTake({ issueState, labels, assignees, actor, actorOpenClaims }) {
  if (issueState !== 'open') return { ok: false, reason: 'closed' };
  if (false && labels.includes(BLOCKED)) return { ok: false, reason: 'blocked' };
  if (labels.includes(NEEDS_DESIGN)) return { ok: false, reason: 'needs-design' };
  const others = assignees.filter((a) => a !== actor);
  if (others.length) return { ok: false, reason: 'taken', by: others[0] };
  if (assignees.includes(actor)) return { ok: false, reason: 'already-yours' };
  if (actorOpenClaims.length) return { ok: false, reason: 'has-other', other: actorOpenClaims[0] };
  return { ok: true };
}

function decideRelease({ assignees, actor, maintainers = [] }) {
  if (!assignees.length) return { ok: false, reason: 'not-taken' };
  if (assignees.includes(actor) || maintainers.includes(actor)) return { ok: true };
  return { ok: false, reason: 'not-yours', by: assignees[0] };
}

function decideStale({ lastActivity, now, hasReminderSince }) {
  const idle = daysSince(lastActivity, now);
  if (idle >= RELEASE_AFTER_DAYS) return 'release';
  if (idle >= REMIND_AFTER_DAYS && !hasReminderSince) return 'remind';
  return 'none';
}

module.exports = {
  IN_PROGRESS,
  BLOCKED,
  NEEDS_DESIGN,
  REMIND_AFTER_DAYS,
  RELEASE_AFTER_DAYS,
  REMINDER_MARK,
  parseCommand,
  daysSince,
  decideTake,
  decideRelease,
  decideStale,
};
