import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLogin?.(result.user);
    } catch (err) {
      console.error("Login failed:", err);
      setError("Invalid email or password");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <img src="/twinmed-logo.avif" className="login-logo" alt="TwinMed logo" />
          <div className="login-heading">
            <h1>Credit Intelligence Center</h1>
            <p className="login-sub">Secure access · Internal users only</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <input
            className="login-input"
            type="email"
            placeholder="Company email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
