import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("App error:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1115", color: "#e7e9ee", fontFamily: "Inter,Arial,sans-serif", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 380 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Algo salió mal</h1>
            <p style={{ color: "#9aa3af", fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>Ocurrió un error inesperado. Recargá la página para continuar. Si el problema sigue, avisale al equipo.</p>
            <button onClick={() => window.location.reload()} style={{ background: "#E8B349", color: "#1a1206", border: "none", borderRadius: 10, padding: "12px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
