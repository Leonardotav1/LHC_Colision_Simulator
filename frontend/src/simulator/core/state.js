export const state = {
  activeFilters: [0, 1, 2, 3, 4, 5],
  currentHeatmapLayer: "ALL",
  objects: [],
  byType: [[], [], [], [], [], []],
  counts: [0, 0, 0, 0, 0, 0],
  meta: {},
  ui: {
    hasRootFile: false,
    activeFilename: "",
  },
  three: {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    animationId: null,
    particles: [],
    grid: null,
    trackerGroup: null,
    playPhysics: true,
    playRotation: true,
  },
};

export function filteredObjects() {
  return state.objects.filter((o) => state.activeFilters.includes(o.typeId));
}
