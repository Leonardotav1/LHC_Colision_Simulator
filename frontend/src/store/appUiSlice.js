import { createSlice } from "@reduxjs/toolkit";

// Truncates long filenames for navbar display while preserving original name.
function formatFileNameForUi(fileName, maxLen = 28) {
  const name = String(fileName || "");
  if (!name || name.length <= maxLen) return name || "nenhum_arquivo.root";
  const keepStart = 14;
  const keepEnd = 10;
  return `${name.slice(0, keepStart)}...${name.slice(-keepEnd)}`;
}

// Global UI feedback state: file label, status line, banners and loading overlay.
const initialState = {
  fileName: "nenhum_arquivo.root",
  fileNameFull: "",
  statusText: "AGUARDANDO ROOT",
  statusColor: "#facc15",
  bannerMessage: "",
  bannerLevel: "warning",
  bannerVisible: true,
  loadingVisible: false,
  loadingMessage: "Simulando...",
  hasRootFile: false,
};

const appUiSlice = createSlice({
  name: "appUi",
  initialState,
  reducers: {
    setFileLabel(state, action) {
      const full = String(action.payload || "");
      state.fileNameFull = full;
      state.fileName = formatFileNameForUi(full);
    },
    setStatus(state, action) {
      state.statusText = action.payload?.text || state.statusText;
      state.statusColor = action.payload?.color || state.statusColor;
    },
    showBanner(state, action) {
      state.bannerMessage = action.payload?.message || "";
      state.bannerLevel = action.payload?.level || "info";
      state.bannerVisible = !!state.bannerMessage;
    },
    clearBanner(state) {
      state.bannerMessage = "";
      state.bannerVisible = false;
    },
    showLoading(state, action) {
      state.loadingVisible = true;
      state.loadingMessage = action.payload?.message || "Simulando...";
    },
    hideLoading(state) {
      state.loadingVisible = false;
    },
    setRootAvailability(state, action) {
      const hasRoot = !!action.payload?.hasRootFile;
      const message = action.payload?.message || "";
      state.hasRootFile = hasRoot;
      if (!hasRoot) {
        state.fileName = "nenhum_arquivo.root";
        state.fileNameFull = "";
        state.statusText = "AGUARDANDO ROOT";
        state.statusColor = "#facc15";
        if (message) {
          state.bannerMessage = message;
          state.bannerLevel = "warning";
          state.bannerVisible = true;
        }
      } else if (message) {
        state.bannerMessage = message;
        state.bannerLevel = "info";
        state.bannerVisible = true;
      }
    },
  },
});

export const {
  setFileLabel,
  setStatus,
  showBanner,
  clearBanner,
  showLoading,
  hideLoading,
  setRootAvailability,
} = appUiSlice.actions;

export default appUiSlice.reducer;
