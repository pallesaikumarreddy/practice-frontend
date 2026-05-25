import { useState } from "react";
import "./App.css";

const API_JAVA = import.meta.env.VITE_JAVA_API_URL || "http://localhost:8080";
const API_PYTHON = import.meta.env.VITE_PYTHON_API_URL || "http://localhost:8000";

export default function App() {
  const [form, setForm] = useState({ name: "", email: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [steps, setSteps] = useState({ db: null, s3: null });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setSteps({ db: null, s3: null });
    setMessage("");

    // Step 1 — Save user to MySQL via Java backend
    let savedUser;
    try {
      const res = await fetch(`${API_JAVA}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Java API error: ${res.status}`);
      }
      savedUser = await res.json();
      setSteps((s) => ({ ...s, db: "success" }));
    } catch (err) {
      setSteps((s) => ({ ...s, db: "error" }));
      setStatus("error");
      setMessage(`Failed to save user: ${err.message}`);
      return;
    }

    // Step 2 — Upload welcome file to S3 via Python backend
    try {
      const res = await fetch(`${API_PYTHON}/api/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: savedUser.id,
          name: savedUser.name,
          email: savedUser.email,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Python API error: ${res.status}`);
      }
      const s3Data = await res.json();
      setSteps((s) => ({ ...s, s3: "success" }));
      setStatus("success");
      setMessage(`Welcome, ${savedUser.name}! File saved at: ${s3Data.s3_key}`);
      setForm({ name: "", email: "" });
    } catch (err) {
      setSteps((s) => ({ ...s, s3: "error" }));
      setStatus("error");
      setMessage(`User saved but S3 upload failed: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div className="logo">◈</div>
          <h1>Create Account</h1>
          <p className="subtitle">Join the platform in seconds</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Ada Lovelace"
              value={form.name}
              onChange={handleChange}
              required
              disabled={status === "loading"}
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="ada@example.com"
              value={form.email}
              onChange={handleChange}
              required
              disabled={status === "loading"}
            />
          </div>

          <button
            type="submit"
            className={`btn ${status === "loading" ? "loading" : ""}`}
            disabled={status === "loading"}
          >
            {status === "loading" ? (
              <span className="spinner" />
            ) : (
              "Register"
            )}
          </button>
        </form>

        {/* Pipeline status */}
        {(steps.db !== null || steps.s3 !== null) && (
          <div className="pipeline">
            <Step
              label="Save to MySQL (Java)"
              state={steps.db ?? "pending"}
            />
            <div className="connector" />
            <Step
              label="Upload to S3 (Python)"
              state={steps.s3 ?? (steps.db === "success" ? "pending" : "idle")}
            />
          </div>
        )}

        {/* Result message */}
        {message && (
          <div className={`alert ${status === "success" ? "alert-ok" : "alert-err"}`}>
            {message}
          </div>
        )}
      </div>

      {/* Architecture diagram */}
      <div className="arch">
        <span className="arch-node react">React</span>
        <Arrow />
        <span className="arch-node java">Spring Boot</span>
        <Arrow />
        <span className="arch-node db">AWS RDS MySQL</span>
        <br className="arch-break" />
        <span className="arch-spacer" />
        <Arrow down />
        <span className="arch-node python">FastAPI</span>
        <Arrow />
        <span className="arch-node s3">AWS S3</span>
      </div>
    </div>
  );
}

function Step({ label, state }) {
  const icons = { success: "✓", error: "✗", pending: "…", idle: "○" };
  return (
    <div className={`step step-${state}`}>
      <span className="step-icon">{icons[state]}</span>
      <span className="step-label">{label}</span>
    </div>
  );
}

function Arrow({ down }) {
  return <span className={`arch-arrow ${down ? "down" : ""}`}>{down ? "↓" : "→"}</span>;
}
