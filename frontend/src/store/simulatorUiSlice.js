import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeTab: "transversal",
  heatmapLayer: "ALL",
  activeFilters: [0, 1, 2, 3, 4, 5],
  controls: {
    playPhysics: true,
    playRotation: true,
    showGrid: true,
    showSensors: true,
  },
};

const simulatorUiSlice = createSlice({
  name: "simulatorUi",
  initialState,
  reducers: {
    setActiveTab(state, action) {
      if (typeof action.payload === "string") state.activeTab = action.payload;
    },
    setHeatmapLayer(state, action) {
      if (typeof action.payload === "string") state.heatmapLayer = action.payload;
    },
    toggleFilter(state, action) {
      const typeId = Number(action.payload);
      if (!Number.isInteger(typeId) || typeId < 0 || typeId > 5) return;
      if (state.activeFilters.length === 6) {
        state.activeFilters = [typeId];
        return;
      }
      const idx = state.activeFilters.indexOf(typeId);
      if (idx > -1) {
        state.activeFilters.splice(idx, 1);
        if (!state.activeFilters.length) state.activeFilters = [0, 1, 2, 3, 4, 5];
        return;
      }
      state.activeFilters.push(typeId);
      if (state.activeFilters.length === 6) state.activeFilters = [0, 1, 2, 3, 4, 5];
    },
    resetFilters(state) {
      state.activeFilters = [0, 1, 2, 3, 4, 5];
    },
    togglePlayPhysics(state) {
      state.controls.playPhysics = !state.controls.playPhysics;
    },
    togglePlayRotation(state) {
      state.controls.playRotation = !state.controls.playRotation;
    },
    toggleShowGrid(state) {
      state.controls.showGrid = !state.controls.showGrid;
    },
    toggleShowSensors(state) {
      state.controls.showSensors = !state.controls.showSensors;
    },
  },
});

export const {
  setActiveTab,
  setHeatmapLayer,
  toggleFilter,
  resetFilters,
  togglePlayPhysics,
  togglePlayRotation,
  toggleShowGrid,
  toggleShowSensors,
} = simulatorUiSlice.actions;

export default simulatorUiSlice.reducer;
