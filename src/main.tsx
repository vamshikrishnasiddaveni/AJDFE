import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const sessionKey = "jobapplying-user";
const applicationsPerPage = 10;

type UserProfile = {
  id: number;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  currentSalary: string;
  expectedSalary: string;
  experienceYears: string;
  noticePeriod: string;
  currentLocation: string;
  preferredLocation: string;
  workAuthorization: string;
  requiresSponsorship: string;
  active: boolean;
  logicalDelete: "Y" | "N";
};

type AuthForm = {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  password: string;
  currentSalary: string;
  expectedSalary: string;
  experienceYears: string;
  noticePeriod: string;
  currentLocation: string;
  preferredLocation: string;
  workAuthorization: string;
  requiresSponsorship: string;
};

type AppliedJob = {
  id: number;
  userId: number;
  jobId: number;
  platform: string;
  jobTitle: string;
  company: string;
  location: string;
  jobLink: string;
  appliedAt: string;
  applicationStatus: string;
  automationStatus: "fully_automatic" | "needs_user_help" | string;
  errorMessage?: string;
};

type BotStatus = {
  running: boolean;
  pid?: number | null;
  mode?: string;
  startedAt?: string | null;
  logFile: string;
  checkedAt: string;
};

const emptyForm: AuthForm = {
  firstName: "",
  lastName: "",
  mobileNumber: "",
  password: "",
  currentSalary: "",
  expectedSalary: "",
  experienceYears: "",
  noticePeriod: "",
  currentLocation: "",
  preferredLocation: "",
  workAuthorization: "Yes",
  requiresSponsorship: "No",
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getApiErrorMessage(text: string, status: number, statusText: string) {
  if (!text) {
    return `${status} ${statusText}`;
  }

  try {
    const body = JSON.parse(text) as { error?: string; message?: string; trace?: string };
    const traceMessage = body.trace?.match(/\d{3} [A-Z_]+ "([^"]+)"/)?.[1];
    return body.message || traceMessage || body.error || `${status} ${statusText}`;
  } catch {
    return text;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getApiErrorMessage(text, response.status, response.statusText));
  }

  return response.json() as Promise<T>;
}

function AuthScreen({ onAuth }: { onAuth: (user: UserProfile) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState<AuthForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update(field: keyof AuthForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    if (nextMode === "register") {
      setSuccess("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (mode === "login") {
        const user = await request<UserProfile>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ mobileNumber: form.mobileNumber, password: form.password }),
        });
        localStorage.setItem(sessionKey, JSON.stringify(user));
        onAuth(user);
        return;
      }

      await request<UserProfile>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess("Successfully registered. Please login to continue.");
      setMode("login");
      setForm((current) => ({
        ...emptyForm,
        mobileNumber: current.mobileNumber,
      }));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <h1>JobApplying Console</h1>
          <p>Sign in to run your job automation workspace.</p>
        </div>

        <div className="segmented">
          <button className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")} type="button">Sign In</button>
          <button className={mode === "register" ? "selected" : ""} onClick={() => switchMode("register")} type="button">Register</button>
        </div>

        {error && <div className="alert">{error}</div>}
        {success && (
          <div className="success-box">
            <span>{success}</span>
            <button type="button" onClick={() => switchMode("login")}>Login</button>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>First Name<input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
              <label>Last Name<input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
            </>
          )}
          <label>Mobile Number<input required value={form.mobileNumber} onChange={(event) => update("mobileNumber", event.target.value)} /></label>
          <label>Password<input required type="password" value={form.password} onChange={(event) => update("password", event.target.value)} /></label>
          {mode === "register" && (
            <>
              <label>Experience<input required value={form.experienceYears} onChange={(event) => update("experienceYears", event.target.value)} placeholder="3-5" /></label>
              <label>Preferred Location<input required value={form.preferredLocation} onChange={(event) => update("preferredLocation", event.target.value)} /></label>
              <label>Current Salary<input value={form.currentSalary} onChange={(event) => update("currentSalary", event.target.value)} /></label>
              <label>Expected Salary<input value={form.expectedSalary} onChange={(event) => update("expectedSalary", event.target.value)} /></label>
              <label>Notice Period<input value={form.noticePeriod} onChange={(event) => update("noticePeriod", event.target.value)} /></label>
              <label>Current Location<input value={form.currentLocation} onChange={(event) => update("currentLocation", event.target.value)} /></label>
            </>
          )}
          <button className="primary" type="submit">{mode === "login" ? "Sign In" : "Create Account"}</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [applications, setApplications] = useState<AppliedJob[]>([]);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const helpNeeded = useMemo(
    () => applications.filter((job) => job.automationStatus === "needs_user_help").length,
    [applications]
  );

  const totalPages = Math.max(1, Math.ceil(applications.length / applicationsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * applicationsPerPage;
  const visibleApplications = applications.slice(pageStart, pageStart + applicationsPerPage);

  async function loadAll() {
    setError("");
    try {
      const [userData, appsData, statusData, logsData] = await Promise.all([
        request<UserProfile>(`/api/users/${currentUser.id}`),
        request<AppliedJob[]>(`/api/applications?userId=${currentUser.id}`),
        request<BotStatus>("/api/bot/status"),
        request<string[]>("/api/bot/logs?lines=80"),
      ]);
      setCurrentUser(userData);
      localStorage.setItem(sessionKey, JSON.stringify(userData));
      setApplications(appsData);
      setStatus(statusData);
      setLogs(logsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load backend data");
    } finally {
      setLoading(false);
    }
  }

  async function startBot() {
    setError("");
    try {
      setStatus(await request<BotStatus>(`/api/bot/start?userId=${currentUser.id}`, { method: "POST" }));
      await loadAll();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start bot");
    }
  }

  async function stopBot() {
    setError("");
    try {
      setStatus(await request<BotStatus>("/api/bot/stop", { method: "POST" }));
      await loadAll();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Unable to stop bot");
    }
  }

  async function toggleActive() {
    setError("");
    if (currentUser.logicalDelete === "Y") {
      setError("This user is locked inactive and cannot change status.");
      return;
    }

    try {
      const updated = await request<UserProfile>(`/api/users/${currentUser.id}/active?active=${!currentUser.active}`, {
        method: "PATCH",
      });
      setCurrentUser(updated);
      localStorage.setItem(sessionKey, JSON.stringify(updated));
      await loadAll();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update user");
    }
  }

  useEffect(() => {
    loadAll();
    const interval = window.setInterval(loadAll, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const eligible = currentUser.logicalDelete !== "Y";
  const effectiveActive = eligible && currentUser.active;
  const statusButtonText = !eligible ? "Locked Inactive" : currentUser.active ? "Turn Off" : "Turn On";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>JobApplying Console</h1>
          <p>{currentUser.firstName} {currentUser.lastName} · User ID {currentUser.id}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={loadAll}>Refresh</button>
          <button type="button" onClick={toggleActive} disabled={!eligible}>{statusButtonText}</button>
          <button type="button" onClick={startBot} disabled={Boolean(status?.running) || !effectiveActive}>Start Bot</button>
          <button type="button" onClick={stopBot} disabled={!status?.running}>Stop Bot</button>
          <button type="button" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {!eligible && <div className="alert">Your account is not eligible to use this tool.</div>}
      {loading && <div className="muted">Loading backend data...</div>}

      <section className="metrics">
        <div><span>Bot</span><strong>{status?.running ? "Running" : "Stopped"}</strong></div>
        <div><span>Mode</span><strong>{status?.mode ? statusLabel(status.mode) : "Java Playwright"}</strong></div>
        <div><span>Tool Access</span><strong>{eligible ? (currentUser.active ? "On" : "Off") : "Blocked"}</strong></div>
        <div><span>Applied Jobs</span><strong>{applications.length}</strong></div>
        <div><span>Needs Help</span><strong>{helpNeeded}</strong></div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="section-head">
            <h2>User Details</h2>
            <span>{eligible ? "logicalDelete=N" : "logicalDelete=Y"}</span>
          </div>
          <div className="detail-list">
            <div><span>Name</span><strong>{currentUser.firstName} {currentUser.lastName}</strong></div>
            <div><span>Mobile</span><strong>{currentUser.mobileNumber}</strong></div>
            <div><span>Experience</span><strong>{currentUser.experienceYears}</strong></div>
            <div><span>Preferred Location</span><strong>{currentUser.preferredLocation}</strong></div>
            <div><span>Status</span><strong>{effectiveActive ? "Active" : "Inactive"}</strong></div>
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <h2>Live Logs</h2>
            <span>{status?.startedAt ? `Started ${new Date(status.startedAt).toLocaleTimeString()}` : status?.logFile ?? "logs/job-bot.log"}</span>
          </div>
          <pre className="logs">{logs.join("\n") || "No logs yet."}</pre>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Applied Jobs</h2>
          <span>
            {applications.length
              ? `${pageStart + 1}-${Math.min(pageStart + applicationsPerPage, applications.length)} of ${applications.length}`
              : "0 jobs"}
          </span>
        </div>
        <div className="table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Role</th>
                <th>Link</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleApplications.map((job) => (
                <tr key={job.id}>
                  <td>{job.company}</td>
                  <td>{job.jobTitle}</td>
                  <td><a href={job.jobLink} target="_blank" rel="noreferrer">Open Job</a></td>
                  <td>
                    <span className={job.applicationStatus === "applied" ? "badge ok" : "badge warn"}>
                      {statusLabel(job.applicationStatus)}
                    </span>
                  </td>
                  <td>{new Date(job.appliedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={activePage === 1}>
            Previous
          </button>
          <span>Page {activePage} of {totalPages}</span>
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={activePage === totalPages}>
            Next
          </button>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(sessionKey);
    return saved ? JSON.parse(saved) as UserProfile : null;
  });

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => {
    localStorage.removeItem(sessionKey);
    setUser(null);
  }} />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
