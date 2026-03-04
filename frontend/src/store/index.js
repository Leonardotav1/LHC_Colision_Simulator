import { configureStore } from "@reduxjs/toolkit";
import simulatorUiReducer from "./simulatorUiSlice.js";

export const store = configureStore({
  reducer: {
    simulatorUi: simulatorUiReducer,
  },
});

export default store;
