import { useEffect, useState } from "react";
import {
  Activity, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Dumbbell,
  History, House, Layers3, Settings, ShieldCheck, Sparkles, WifiOff
} from "lucide-react";
import { readValue, writeValue } from "./lib/db.js";
import { INITIAL_STATE } from "./lib/seed.js";

const navItems = [
  { id: "home", label: "Home", icon: House },
  { id: "plans", label: "Plans", icon: Dumbbell },
  { id: "progress", label: "Progress", icon: History },
  { id: "settings", label: "Settings", icon: Settings }
];

function App() {
  const [page, setPage] = useState("home");
  const [appState, setAppState] = useState(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    readValue("state")
      .then(async (saved) => {
        if (cancelled) return;
        if (saved && saved.schemaVersion === INITIAL_STATE.schemaVersion) {
          setAppState(saved);
        } else {
          await writeValue("state", INITIAL_STATE);
          setAppState(INITIAL_STATE);
        }
      })
      .catch((error) => {
        if (!cancelled) setStorageError(error.message || "Local storage is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded || storageError) return;
    writeValue("state", appState).catch((error) => setStorageError(error.message || "Could not save data."));
  }, [appState, loaded, storageError]);

  const nextPlan = appState.masterPlans[appState.nextPlanIndex] || appState.masterPlans[0];

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function startStageTwoPreview() {
    showNotice("Stage 1 is ready. Workout rotation will be implemented in Stage 2.");
  }

  if (!loaded) {
    return <main className="loading-screen"><div className="brand-mark"><Activity /></div><p>Opening GymFlow…</p></main>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={21} /></div>
          <div><div className="brand-name">GymFlow</div><div className="brand-subtitle">YOUR PERSONAL GYM COMPANION</div></div>
        </div>
        <span className="local-pill"><span className="status-dot" /> Local</span>
      </header>

      {storageError && (
        <div className="error-banner" role="alert">
          <ShieldCheck size={18} />
          <div><strong>Local storage issue</strong><p>{storageError} Your changes may not be saved.</p></div>
        </div>
      )}

      <main className="main-content">
        {page === "home" && <HomePage nextPlan={nextPlan} hasActive={Boolean(appState.activeSession)} hasOverride={Boolean(appState.override)} onStart={startStageTwoPreview} onNavigate={setPage} />}
        {page === "plans" && <PlansPage plans={appState.masterPlans} onNotice={showNotice} />}
        {page === "progress" && <ProgressPage sessions={appState.sessions} />}
        {page === "settings" && <SettingsPage onNotice={showNotice} />}
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => setPage(id)} aria-current={page === id ? "page" : undefined}>
            <Icon size={21} strokeWidth={page === id ? 2.4 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomePage({ nextPlan, hasActive, hasOverride, onStart, onNavigate }) {
  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div><p className="eyebrow">YOUR NEXT SESSION</p><h1>Ready when<br />you are.</h1></div>
        <div className="hero-icon"><Activity size={31} /></div>
      </section>

      <section className="next-workout-card">
        <div className="card-topline"><span className="eyebrow">UP NEXT · PLAN {Number(nextPlan.id.split("-")[1])} OF 5</span><span className="plan-symbol"><Dumbbell size={18} /></span></div>
        <h2>{nextPlan.name}</h2>
        <p className="muted plan-focus">{nextPlan.focus}</p>
        <div className="plan-meta">
          <span><CalendarDays size={15} /> {nextPlan.durationMinutes} min</span>
          <span><Layers3 size={15} /> {nextPlan.exercises} exercises</span>
        </div>
        <div className="rotation-track" aria-label={`Plan ${Number(nextPlan.id.split("-")[1])} of 5`}>
          {nextPlan && Array.from({ length: 5 }, (_, index) => (
            <span key={index} className={`rotation-segment ${index === Number(nextPlan.id.split("-")[1]) - 1 ? "current" : ""}`} />
          ))}
        </div>
        {hasOverride && <div className="override-note"><Sparkles size={15} /> One-time session override is saved</div>}
        {hasActive && <div className="active-note"><Activity size={15} /> You have an unfinished workout to resume</div>}
        <button className="button button-primary button-large" onClick={onStart}>
          {hasActive ? "Resume workout" : "Start workout"} <ChevronRight size={19} />
        </button>
        <p className="card-footnote">Your rotation follows completed workouts, not weekdays.</p>
      </section>

      <div className="quick-actions">
        <button className="quick-action" onClick={() => onNavigate("plans")}><span className="quick-icon"><Dumbbell size={19} /></span><span><strong>Manage plans</strong><small>Edit your 5 routines</small></span><ChevronRight size={18} /></button>
        <button className="quick-action" onClick={() => onNavigate("progress")}><span className="quick-icon"><History size={19} /></span><span><strong>Workout history</strong><small>Review your progress</small></span><ChevronRight size={18} /></button>
      </div>

      <div className="info-strip"><WifiOff size={17} /><p><strong>Designed for the gym.</strong> Core features will work offline after setup.</p></div>
    </div>
  );
}

function PlansPage({ plans, onNotice }) {
  return (
    <div className="page-stack">
      <div className="page-heading"><p className="eyebrow">YOUR ROUTINE</p><h1>Workout plans</h1><p className="muted">Five plans, one continuous rotation.</p></div>
      <div className="plan-list">
        {plans.map((plan, index) => (
          <button key={plan.id} className="plan-list-card" onClick={() => onNotice("Plan editing will be implemented in a later stage.")}>
            <span className="plan-number">{index + 1}</span>
            <span className="plan-list-copy"><strong>{plan.name}</strong><small>{plan.focus}</small><small>{plan.durationMinutes} min · {plan.exercises} exercises</small></span>
            <ChevronRight size={19} />
          </button>
        ))}
      </div>
      <div className="info-strip"><CircleHelp size={17} /><p>Editing, exercise swaps and one-time overrides are planned for the next stages.</p></div>
    </div>
  );
}

function ProgressPage({ sessions }) {
  return (
    <div className="page-stack">
      <div className="page-heading"><p className="eyebrow">YOUR JOURNEY</p><h1>Progress</h1><p className="muted">Every visit counts.</p></div>
      <section className="stat-grid">
        <div className="stat-card"><span className="stat-icon"><CheckCircle2 size={19} /></span><strong>{sessions.filter((s) => s.status === "completed").length}</strong><small>Completed workouts</small></div>
        <div className="stat-card"><span className="stat-icon"><Activity size={19} /></span><strong>{sessions.length}</strong><small>Sessions recorded</small></div>
      </section>
      <section className="empty-state">
        <div className="empty-icon"><History size={27} /></div>
        <h2>No workout history yet</h2>
        <p>Your completed sessions will appear here once workout tracking is implemented.</p>
      </section>
    </div>
  );
}

function SettingsPage({ onNotice }) {
  return (
    <div className="page-stack">
      <div className="page-heading"><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Your app, your routine.</p></div>
      <section className="settings-card">
        <div className="settings-row"><span className="settings-icon"><ShieldCheck size={19} /></span><span><strong>Local-first storage</strong><small>Your workout data stays on this device in v1.</small></span><span className="settings-status">On</span></div>
        <div className="settings-row"><span className="settings-icon"><Activity size={19} /></span><span><strong>Appearance</strong><small>Dark green theme</small></span></div>
        <div className="settings-row"><span className="settings-icon"><History size={19} /></span><span><strong>Backup and restore</strong><small>Export and import will be added later.</small></span><ChevronRight size={18} /></div>
      </section>
      <button className="button button-secondary button-large" onClick={() => onNotice("Settings and backup controls will be implemented in a later stage.")}>View app information</button>
      <p className="version-note">GymFlow · Stage 1 foundation · v0.1.0</p>
    </div>
  );
}

export default App;
