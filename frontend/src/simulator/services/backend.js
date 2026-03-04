import { PARTICLE } from "../core/constants.js";

export async function parseApiError(res, fallback) {
  let payload = null;
  try {
    payload = await res.json();
  } catch (_) {
    payload = null;
  }
  throw new Error(payload?.error || `${fallback} (${res.status})`);
}

export async function uploadRootFile(serverUrl, file) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${serverUrl}/upload/`, { method: "POST", body });
  if (!res.ok) await parseApiError(res, "Falha no upload");
  return res.json();
}

export async function clearRootFiles(serverUrl, keepalive = false) {
  const res = await fetch(`${serverUrl}/upload/clear`, { method: "POST", keepalive });
  if (!res.ok) await parseApiError(res, "Falha ao limpar uploads ROOT");
  return res.json();
}

export async function listRootFiles(serverUrl) {
  const res = await fetch(`${serverUrl}/upload/files`);
  if (!res.ok) await parseApiError(res, "Falha ao listar arquivos ROOT");
  return res.json();
}

export async function getActiveRoot(serverUrl) {
  const res = await fetch(`${serverUrl}/upload/active`);
  if (!res.ok) return null;
  return res.json();
}

export async function getActiveRootStats(serverUrl) {
  const res = await fetch(`${serverUrl}/upload/stats`);
  if (!res.ok) await parseApiError(res, "Falha ao carregar estatisticas do ROOT ativo");
  return res.json();
}

export async function selectRootFile(serverUrl, filename) {
  const res = await fetch(`${serverUrl}/upload/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) await parseApiError(res, "Falha ao selecionar ROOT");
  return res.json();
}

// Função para simular eventos a partir do backend, usando os parâmetros de início e número de eventos desejados.
export async function simulateFromBackend(serverUrl, start, num) {
  const res = await fetch(`${serverUrl}/simulate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start_event: start, num_events: num }),
  });

  if (!res.ok) await parseApiError(res, "Falha ao simular evento");
  
  return JSON.parse(await res.text());
}

export function mapType(rawType) {
  const t = String(rawType || "").toLowerCase();
  if (t === "muon") return PARTICLE.MUON;
  if (t === "electron") return PARTICLE.ELECTRON;
  if (t === "photon") return PARTICLE.PHOTON;
  if (t === "jet" || t === "hadron") return PARTICLE.HADRON;
  if (t === "met") return PARTICLE.MET;
  if (t === "tau") return PARTICLE.TAU;
  return null;
}

export function recoValue(obj) {
  if (obj.typeId === PARTICLE.MET) {
    const m = obj.reco?.met_gev;
    return typeof m === "number" ? m : Number(m?.nominal ?? 0);
  }
  const p = obj.reco?.pt_gev;
  return typeof p === "number" ? p : Number(p?.nominal ?? 0);
}

export function parseObjects(fig) {
  const traces = Array.isArray(fig?.data) ? fig.data : [];
  return traces
    .filter((t) => t?.meta && Array.isArray(t.meta.trajectory) && t.meta.trajectory.length > 1)
    .map((t) => ({
      type: t.meta.type,
      typeId: mapType(t.meta.type),
      color: t.meta.color || "#ffffff",
      stopReason: t.meta.stop_reason || "unknown",
      trajectory: t.meta.trajectory,
      reco: t.meta.reco || {},
    }))
    .filter((o) => o.typeId !== null);
}
