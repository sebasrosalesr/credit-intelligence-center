import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import MonitoringBoundary from "./monitoring/MonitoringBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MonitoringBoundary>
      <App />
    </MonitoringBoundary>
  </React.StrictMode>
);
