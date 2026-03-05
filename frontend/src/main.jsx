import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App.jsx";
import { store } from "./store/index.js";
import "./styles.css";

// React entrypoint: mounts the app with Redux provider.
createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
  </Provider>
);
