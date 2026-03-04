import { state } from "../core/state.js";

export function byId(id) {
  return document.getElementById(id);
}

export function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value;
}

export function formatFileNameForUi(fileName, maxLen = 28) {
  const name = String(fileName || "");
  if (!name || name.length <= maxLen) return name;
  const keepStart = 14;
  const keepEnd = 10;
  return `${name.slice(0, keepStart)}...${name.slice(-keepEnd)}`;
}

export function setFileNameLabel(fileName) {
  const el = byId("fileNameLabel");
  if (!el) return;
  const full = String(fileName || "");
  el.textContent = formatFileNameForUi(full);
  el.title = full;
}

export function showLoading(message = "Simulando...") {
  const overlay = byId("loadingOverlay");
  const text = byId("loadingText");
  if (text) text.textContent = message;
  if (overlay) overlay.classList.add("show");
}

export function hideLoading() {
  const overlay = byId("loadingOverlay");
  if (overlay) overlay.classList.remove("show");
}

export function syncEventInputBounds() {
  const totalEl = byId("totalEventosInput");
  const eventEl = byId("eventoInput");
  const numEl = byId("numInput");
  if (!totalEl || !eventEl || !numEl) return;

  const total = Number(totalEl.value || 0);
  if (!Number.isFinite(total) || total <= 0) return;

  let start = Number(eventEl.value || 1);
  if (!Number.isFinite(start)) start = 1;
  start = Math.max(1, Math.min(total, start));
  eventEl.value = String(start);
  eventEl.max = String(total);

  const remaining = Math.max(1, total - start + 1);
  numEl.max = String(remaining);
  let n = Number(numEl.value || 1);
  if (!Number.isFinite(n)) n = 1;
  n = Math.max(1, Math.min(remaining, n));
  numEl.value = String(n);
}

export function showBanner(message, level = "error") {
  const banner = byId("errorBanner");
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove("error", "warning", "info");
  banner.classList.add(level);
  banner.classList.add("show");
}

export function clearError() {
  const banner = byId("errorBanner");
  if (!banner) return;
  banner.textContent = "";
  banner.classList.remove("error", "warning", "info");
  banner.classList.remove("show");
}

export function showError(message) {
  showBanner(message, "error");
}

export function setStatus(text, color = "#facc15") {
  const el = byId("statusLabel");
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
}

export function setSimulationEnabled(enabled) {
  const simBtn = byId("simMainBtn");
  const eventInput = byId("eventoInput");
  const numInput = byId("numInput");
  if (simBtn) simBtn.disabled = !enabled;
  if (eventInput) eventInput.disabled = !enabled;
  if (numInput) numInput.disabled = !enabled;
}

export function setRootAvailability(hasRootFile, message = "") {
  state.ui.hasRootFile = hasRootFile;
  setSimulationEnabled(hasRootFile);
  if (!hasRootFile) {
    state.ui.activeFilename = "";
    setFileNameLabel("nenhum_arquivo.root");
    setStatus("AGUARDANDO ROOT", "#facc15");
    if (message) showBanner(message, "warning");
    return;
  }
  clearError();
}
