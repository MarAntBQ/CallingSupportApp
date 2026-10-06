const test = require('node:test');
const assert = require('node:assert/strict');
const l = require('./claim-logic.cjs');

test('parseCommand reconoce los comandos en los 3 idiomas', () => {
  for (const c of ['/tomar', '/assumir', '/take', '/TOMAR', '  /tomar lo empiezo hoy']) assert.equal(l.parseCommand(c), 'take');
  for (const c of ['/soltar', '/liberar', '/release']) assert.equal(l.parseCommand(c), 'release');
  for (const c of ['voy a /tomar esto', 'hola', '', null, '/tomarlo']) assert.equal(l.parseCommand(c), null);
});

const base = { issueState: 'open', labels: [], assignees: [], actor: 'luis', actorOpenClaims: [] };

test('decideTake: issue libre se puede tomar', () => {
  assert.deepEqual(l.decideTake(base), { ok: true });
});

test('decideTake: cerrado, bloqueado o con diseño pendiente se rechaza', () => {
  assert.equal(l.decideTake({ ...base, issueState: 'closed' }).reason, 'closed');
  assert.equal(l.decideTake({ ...base, labels: ['bloqueado'] }).reason, 'blocked');
  assert.equal(l.decideTake({ ...base, labels: ['necesita-diseño'] }).reason, 'needs-design');
});

test('decideTake: ya lo tiene otra persona', () => {
  assert.deepEqual(l.decideTake({ ...base, assignees: ['steven'] }), { ok: false, reason: 'taken', by: 'steven' });
});

test('decideTake: un issue a la vez, salvo el responsable', () => {
  assert.deepEqual(l.decideTake({ ...base, actorOpenClaims: [12] }), { ok: false, reason: 'has-other', other: 12 });
  assert.deepEqual(l.decideTake({ ...base, actor: 'MarAntBQ', actorOpenClaims: [12] }), { ok: true });
});

test('decideRelease: solo quien lo tiene o el responsable', () => {
  assert.equal(l.decideRelease({ assignees: [], actor: 'luis' }).reason, 'not-taken');
  assert.deepEqual(l.decideRelease({ assignees: ['luis'], actor: 'luis' }), { ok: true });
  assert.deepEqual(l.decideRelease({ assignees: ['luis'], actor: 'MarAntBQ' }), { ok: true });
  assert.deepEqual(l.decideRelease({ assignees: ['luis'], actor: 'steven' }), { ok: false, reason: 'not-yours', by: 'luis' });
});

test('decideStale: recuerda a los 7 días, una sola vez, y libera a los 14', () => {
  const now = '2026-10-20T12:00:00Z';
  assert.equal(l.decideStale({ lastActivity: '2026-10-14T12:00:00Z', now, hasReminderSince: false }), 'none');
  assert.equal(l.decideStale({ lastActivity: '2026-10-13T12:00:00Z', now, hasReminderSince: false }), 'remind');
  assert.equal(l.decideStale({ lastActivity: '2026-10-13T12:00:00Z', now, hasReminderSince: true }), 'none');
  assert.equal(l.decideStale({ lastActivity: '2026-10-06T12:00:00Z', now, hasReminderSince: true }), 'release');
  assert.equal(l.decideStale({ lastActivity: '2026-10-06T12:00:00Z', now, hasReminderSince: false }), 'release');
});
