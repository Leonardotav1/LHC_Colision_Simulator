// Canonical particle ids shared across runtime, plots and Redux state.
export const PARTICLE = {
  MUON: 0,
  ELECTRON: 1,
  PHOTON: 2,
  HADRON: 3,
  MET: 4,
  TAU: 5,
};

// Display names for the pie chart and filter badges.
export const PARTICLE_NAMES = ["Muons", "Eletrons", "Fotons", "Hadrons", "MET", "Taus"];

// Main palette used by the UI and 3D/2D traces.
export const PARTICLE_COLORS = ["#06b6d4", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#d946ef"];

// Dimmed palette used when a particle type is filtered out.
export const PARTICLE_COLORS_DIM = ["#023e4a", "#4a1010", "#102a5c", "#0a3d1b", "#522206", "#4a1352"];
