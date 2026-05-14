import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type ResumeSummary = {
  candidateName?: string;
  email?: string;
  phone?: string;
  totalExperience?: string;
  currentCompany?: string;
  currentRole?: string;
  skills?: string[];
  education?: string[];
  currentLocation?: string;
  preferredLocation?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
};

type ResumeResponse = {
  exists: boolean;
  id: number | null;
  userId: number;
  originalFileName: string | null;
  contentType: string | null;
  fileSize: number;
  uploadedAt: string | null;
  updatedAt: string | null;
  parsedSummary: ResumeSummary | null;
};

type ProfileForm = Omit<UserProfile, "id" | "active" | "logicalDelete">;

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
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

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
};

function toProfileForm(user: UserProfile): ProfileForm {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    mobileNumber: user.mobileNumber,
    currentSalary: user.currentSalary,
    expectedSalary: user.expectedSalary,
    experienceYears: user.experienceYears,
    noticePeriod: user.noticePeriod,
    currentLocation: user.currentLocation,
    preferredLocation: user.preferredLocation,
    workAuthorization: user.workAuthorization,
    requiresSponsorship: user.requiresSponsorship,
  };
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function logLineClass(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes("failed") || normalized.includes("error")) {
    return "log-line error";
  }
  if (normalized.includes("needs user help") || normalized.includes("manual input")) {
    return "log-line warn";
  }
  if (normalized.includes("retrying")) {
    return "log-line retry";
  }
  if (normalized.includes("applying to")) {
    return "log-line active";
  }
  if (normalized.includes("success") || normalized.includes("applied")) {
    return "log-line ok";
  }
  return "log-line";
}

function isSubmittedApplication(job: AppliedJob) {
  return job.applicationStatus.toLowerCase() === "submitted" || job.automationStatus === "fully_automatic";
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

async function uploadResume(userId: number, file: File): Promise<ResumeResponse> {
  const data = new FormData();
  data.append("file", file);

  const response = await fetch(`${apiBaseUrl}/api/users/${userId}/resume`, {
    method: "POST",
    body: data,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getApiErrorMessage(text, response.status, response.statusText));
  }

  return response.json() as Promise<ResumeResponse>;
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
  const [resume, setResume] = useState<ResumeResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeView, setActiveView] = useState<"dashboard" | "profile">("dashboard");
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => toProfileForm(user));
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const profileDirtyRef = useRef(false);

  const helpNeeded = useMemo(
    () => applications.filter((job) => job.automationStatus === "needs_user_help").length,
    [applications]
  );
  const appliedCount = useMemo(
    () => applications.filter(isSubmittedApplication).length,
    [applications]
  );
  const totalApplications = applications.length;

  const totalPages = Math.max(1, Math.ceil(applications.length / applicationsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * applicationsPerPage;
  const visibleApplications = applications.slice(pageStart, pageStart + applicationsPerPage);

  async function loadAll() {
    setError("");
    try {
      const [userData, appsData, statusData, logsData, resumeData] = await Promise.all([
        request<UserProfile>(`/api/users/${currentUser.id}`),
        request<AppliedJob[]>(`/api/applications?userId=${currentUser.id}`),
        request<BotStatus>("/api/bot/status"),
        request<string[]>("/api/bot/logs?lines=80"),
        request<ResumeResponse>(`/api/users/${currentUser.id}/resume`),
      ]);
      setCurrentUser(userData);
      if (!profileDirtyRef.current) {
        setProfileForm(toProfileForm(userData));
      }
      localStorage.setItem(sessionKey, JSON.stringify(userData));
      setApplications(appsData);
      setStatus(statusData);
      setLogs(logsData);
      setResume(resumeData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load backend data");
    } finally {
      setLoading(false);
    }
  }

  function updateProfileField(field: keyof ProfileForm, value: string) {
    profileDirtyRef.current = true;
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function updatePasswordField(field: keyof PasswordForm, value: string) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSavingProfile(true);

    try {
      const updated = await request<UserProfile>(`/api/users/${currentUser.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify(profileForm),
      });
      setCurrentUser(updated);
      setProfileForm(toProfileForm(updated));
      profileDirtyRef.current = false;
      localStorage.setItem(sessionKey, JSON.stringify(updated));
      setSuccess("Profile updated successfully.");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Unable to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setChangingPassword(true);

    try {
      await request<UserProfile>(`/api/users/${currentUser.id}/password`, {
        method: "PATCH",
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm(emptyPasswordForm);
      setSuccess("Password changed successfully.");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Unable to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function submitResume(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!resumeFile) {
      setError("Choose a PDF or DOCX resume to upload.");
      return;
    }

    setUploadingResume(true);
    try {
      const uploaded = await uploadResume(currentUser.id, resumeFile);
      setResume(uploaded);
      setResumeFile(null);
      setSuccess("Resume uploaded and parsed successfully.");
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : "Unable to upload resume");
    } finally {
      setUploadingResume(false);
    }
  }

  async function startBot() {
    setError("");
    try {
      if (currentUser.logicalDelete === "Y") {
        setError("This user is locked inactive and cannot start applying.");
        return;
      }

      if (!currentUser.active) {
        const activated = await request<UserProfile>(`/api/users/${currentUser.id}/active?active=true`, {
          method: "PATCH",
        });
        setCurrentUser(activated);
        localStorage.setItem(sessionKey, JSON.stringify(activated));
      }

      setStatus(await request<BotStatus>(`/api/bot/start?userId=${currentUser.id}`, { method: "POST" }));
      await loadAll();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start applying");
    }
  }

  async function stopBot() {
    setError("");
    try {
      setStatus(await request<BotStatus>("/api/bot/stop", { method: "POST" }));
      if (currentUser.active) {
        const deactivated = await request<UserProfile>(`/api/users/${currentUser.id}/active?active=false`, {
          method: "PATCH",
        });
        setCurrentUser(deactivated);
        localStorage.setItem(sessionKey, JSON.stringify(deactivated));
      }
      await loadAll();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Unable to stop applying");
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
  const modeLabel = !eligible ? "No Access" : status?.running ? "Applying" : "On Hold";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>JobApplying Console</h1>
          <p>{currentUser.firstName} {currentUser.lastName} · User ID {currentUser.id}</p>
        </div>
        <div className="actions">
          <button className={activeView === "dashboard" ? "selected" : ""} type="button" onClick={() => setActiveView("dashboard")}>Dashboard</button>
          <button className={activeView === "profile" ? "selected" : ""} type="button" onClick={() => setActiveView("profile")}>Profile</button>
          <button type="button" onClick={loadAll}>Refresh</button>
          {status?.running ? (
            <button className="primary-action" type="button" onClick={stopBot}>Stop Applying</button>
          ) : (
            <button className="primary-action" type="button" onClick={startBot} disabled={!eligible}>Start Applying</button>
          )}
          <button type="button" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {success && <div className="success-box"><span>{success}</span></div>}
      {!eligible && <div className="alert">Your account is not eligible to use this tool.</div>}
      {loading && <div className="muted">Loading backend data...</div>}

      {activeView === "dashboard" ? (
        <>
          <section className="metrics">
            <div><span>Mode</span><strong>{modeLabel}</strong></div>
            <div><span>Total Applications</span><strong>{totalApplications}</strong></div>
            <div><span>Applied Jobs</span><strong>{appliedCount}</strong></div>
            <div><span>Needs Help</span><strong>{helpNeeded}</strong></div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Live Logs</h2>
              <span>{status?.startedAt ? `Started ${new Date(status.startedAt).toLocaleTimeString()}` : status?.logFile ?? "logs/job-bot.log"}</span>
            </div>
            <div className="logs">
              {logs.length ? logs.map((line, index) => (
                <div className={logLineClass(line)} key={`${index}-${line}`}>{line}</div>
              )) : <div className="log-line">No logs yet.</div>}
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
                        <span className={isSubmittedApplication(job) ? "badge ok" : "badge warn"}>
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
        </>
      ) : (
        <>
          <section className="grid-two">
            <div className="panel">
              <div className="section-head">
                <h2>User Details</h2>
                <span>{effectiveActive ? "Active" : "Inactive"}</span>
              </div>
              <div className="detail-list">
                <div><span>Name</span><strong>{currentUser.firstName} {currentUser.lastName}</strong></div>
                <div><span>Mobile</span><strong>{currentUser.mobileNumber}</strong></div>
                <div><span>Experience</span><strong>{currentUser.experienceYears}</strong></div>
                <div><span>Current Location</span><strong>{currentUser.currentLocation || "Not set"}</strong></div>
                <div><span>Preferred Location</span><strong>{currentUser.preferredLocation}</strong></div>
                <div><span>Notice Period</span><strong>{currentUser.noticePeriod || "Not set"}</strong></div>
                <div><span>Current Salary</span><strong>{currentUser.currentSalary || "Not set"}</strong></div>
                <div><span>Expected Salary</span><strong>{currentUser.expectedSalary || "Not set"}</strong></div>
                <div><span>Work Authorization</span><strong>{currentUser.workAuthorization || "Not set"}</strong></div>
                <div><span>Sponsorship</span><strong>{currentUser.requiresSponsorship || "Not set"}</strong></div>
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <h2>Resume</h2>
                <span>{resume?.exists ? "Uploaded" : "Missing"}</span>
              </div>
              <div className="resume-panel">
                <div className="resume-status">
                  <span>Current Resume</span>
                  <strong>{resume?.exists ? resume.originalFileName : "No resume uploaded"}</strong>
                  {resume?.uploadedAt && <small>Uploaded {new Date(resume.uploadedAt).toLocaleString()}</small>}
                </div>

                {resume?.parsedSummary && (
                  <div className="summary-list">
                    <div><span>Name</span><strong>{resume.parsedSummary.candidateName || "Not found"}</strong></div>
                    <div><span>Email</span><strong>{resume.parsedSummary.email || "Not found"}</strong></div>
                    <div><span>Phone</span><strong>{resume.parsedSummary.phone || "Not found"}</strong></div>
                    <div><span>Experience</span><strong>{resume.parsedSummary.totalExperience || "Not found"}</strong></div>
                    <div><span>Role</span><strong>{resume.parsedSummary.currentRole || "Not found"}</strong></div>
                    <div><span>Location</span><strong>{resume.parsedSummary.currentLocation || "Not found"}</strong></div>
                  </div>
                )}

                <form className="upload-form" onSubmit={submitResume}>
                  <label>Upload New Resume<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)} /></label>
                  <button className="primary" type="submit" disabled={uploadingResume}>{uploadingResume ? "Uploading..." : "Upload Resume"}</button>
                </form>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Update User Details</h2>
              <span>Editable profile fields</span>
            </div>
            <form className="profile-form" onSubmit={saveProfile}>
              <label>First Name<input required value={profileForm.firstName} onChange={(event) => updateProfileField("firstName", event.target.value)} /></label>
              <label>Last Name<input required value={profileForm.lastName} onChange={(event) => updateProfileField("lastName", event.target.value)} /></label>
              <label>Mobile<input required value={profileForm.mobileNumber} onChange={(event) => updateProfileField("mobileNumber", event.target.value)} /></label>
              <label>Experience<input required value={profileForm.experienceYears} onChange={(event) => updateProfileField("experienceYears", event.target.value)} /></label>
              <label>Current Salary<input value={profileForm.currentSalary} onChange={(event) => updateProfileField("currentSalary", event.target.value)} /></label>
              <label>Expected Salary<input value={profileForm.expectedSalary} onChange={(event) => updateProfileField("expectedSalary", event.target.value)} /></label>
              <label>Notice Period<input value={profileForm.noticePeriod} onChange={(event) => updateProfileField("noticePeriod", event.target.value)} /></label>
              <label>Current Location<input value={profileForm.currentLocation} onChange={(event) => updateProfileField("currentLocation", event.target.value)} /></label>
              <label>Preferred Location<input required value={profileForm.preferredLocation} onChange={(event) => updateProfileField("preferredLocation", event.target.value)} /></label>
              <label>Work Authorization<input value={profileForm.workAuthorization} onChange={(event) => updateProfileField("workAuthorization", event.target.value)} /></label>
              <label>Requires Sponsorship<input value={profileForm.requiresSponsorship} onChange={(event) => updateProfileField("requiresSponsorship", event.target.value)} /></label>
              <button className="primary" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save User Details"}</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Password</h2>
              <span>Secure update</span>
            </div>
            <form className="password-form" onSubmit={changePassword}>
              <label>Current Password<input required type="password" value={passwordForm.currentPassword} onChange={(event) => updatePasswordField("currentPassword", event.target.value)} /></label>
              <label>New Password<input required minLength={6} type="password" value={passwordForm.newPassword} onChange={(event) => updatePasswordField("newPassword", event.target.value)} /></label>
              <button className="primary" type="submit" disabled={changingPassword}>{changingPassword ? "Changing..." : "Change Password"}</button>
            </form>
          </section>
        </>
      )}
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
