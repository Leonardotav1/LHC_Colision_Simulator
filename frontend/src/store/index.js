import { configureStore } from "@reduxjs/toolkit";
import simulatorUiReducer from "./simulatorUiSlice.js";
import appUiReducer from "./appUiSlice.js";

// Central Redux store with runtime controls and app feedback state.
export const store = configureStore({
  reducer: {
    simulatorUi: simulatorUiReducer,
    appUi: appUiReducer,
  },
});

export default store;
