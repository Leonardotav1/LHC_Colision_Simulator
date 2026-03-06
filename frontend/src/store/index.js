import { configureStore } from "@reduxjs/toolkit";
import simulatorUiReducer from "./simulatorUiSlice.js";
import appUiReducer from "./appUiSlice.js";

// Redux central para gerenciar o estado global da aplicação, incluindo o estado da UI do simulador e o estado geral da interface.
export const store = configureStore({
  reducer: {
    simulatorUi: simulatorUiReducer,
    appUi: appUiReducer,
  },
});

export default store;
