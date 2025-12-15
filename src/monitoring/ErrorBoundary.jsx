import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    const { error } = this.state;
    if (error) {
      const Fallback = this.props.fallback;
      if (Fallback) {
        return <Fallback error={error} reset={this.handleReset} />;
      }
      return (
        <div
          className="panel"
          style={{
            margin: "2rem",
            padding: "1.5rem",
            border: "1px solid rgba(248,113,113,0.35)",
            background: "rgba(248,113,113,0.06)",
            color: "#fecdd3",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Something went wrong</h3>
          <p style={{ color: "#fda4af" }}>{error.message || "Unknown error"}</p>
          <button className="btn" type="button" onClick={this.handleReset}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
