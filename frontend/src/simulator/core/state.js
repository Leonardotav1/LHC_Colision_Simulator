// Maneja o estado global do simulador, incluindo filtros ativos, objetos simulados e configurações da cena 3D.
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
  // Filtros ativos para os tipos de partículas, usados para determinar quais objetos devem ser renderizados na visualização 3D e nos gráficos.
  return state.objects.filter((o) => state.activeFilters.includes(o.typeId));
}
