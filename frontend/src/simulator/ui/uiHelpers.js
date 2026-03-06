// Small DOM helper used by runtime modules.
export function byId(id) {
  return document.getElementById(id);
}

export function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

export function syncEventInputBounds() {
  // Keeps start event and event count consistent with total available events.
  const totalEl = byId("totalEventosInput");
  const eventEl = byId("eventoInput");
  const numEl = byId("numInput");
  if (!totalEl || !eventEl || !numEl) return;

  const total = Number(totalEl.value || 0);
  if (!Number.isFinite(total) || total <= 0) return;

  let start = Number(eventEl.value || 0);
  if (!Number.isFinite(start)) start = 0;
  start = Math.max(0, Math.min(total - 1, start));
  eventEl.value = String(start);
  eventEl.min = "0";
  eventEl.max = String(Math.max(0, total - 1));

  const remaining = Math.max(1, total - start);
  numEl.max = String(remaining);
  let n = Number(numEl.value || 1);
  if (!Number.isFinite(n)) n = 1;
  n = Math.max(1, Math.min(remaining, n));
  numEl.value = String(n);
}
