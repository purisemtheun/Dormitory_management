// src/components/common/RouteError.jsx
import React from "react";
import { useRouteError } from "react-router-dom";

export default function RouteError() {
  const err = useRouteError();
  const msg = err?.statusText || err?.message || "Something went wrong";
  return (
    <div style={{ padding: 24 }}>
      <h2>Oops! Route Error</h2>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)}
      </pre>
    </div>
  );
}
