import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const formatAuthError = (err) => {
    const code = err?.code || "";
    if (code === "auth/invalid-api-key" || code === "auth/invalid-credential") {
      return "Firebase config looks wrong (invalid API key/credential). Verify Vercel env vars and redeploy.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase. Add your Vercel domain to Firebase Auth → Settings → Authorized domains.";
    }
    if (code === "auth/user-not-found" || code === "auth/wrong-password") {
      return "Invalid email or password.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Email/Password sign-in is disabled in Firebase. Enable it in Firebase Auth → Sign-in method.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Wait a bit and try again.";
    }
    if (String(err?.message || "").includes("auth argument must be")) {
      return "Firebase Auth is not initialized. Check Vercel env vars (VITE_FIREBASE_*) and redeploy.";
    }
    return `Login failed${code ? ` (${code})` : ""}. Check the browser console for details.`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLogin?.(result.user);
    } catch (err) {
      console.error("Login failed:", err);
      setError(formatAuthError(err));
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
