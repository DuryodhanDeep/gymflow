import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, CircleHelp, Dumbbell, History, House, Layers3,
  PauseCircle, Plus, RotateCcw, Settings, ShieldCheck, Sparkles, Trash2,
  WifiOff, X, XCircle
} from "lucide-react";
import { readValue, writeValue } from "./lib/db.js";
import { INITIAL_STATE, migrateState, normalizeExercise, normalizePlan } from "./lib/seed.js";

const navItems = [
  { id: "home", label: "Home", icon: House },
  { id: "plans", label: "Plans", icon: Dumbbell },
  { id: "progress", label: "Progress", icon: History },
  { id: "settings", label: "Settings", icon: Settings }
];

function makeId(prefix = "item") {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}
function clonePlan(plan) {
  return { ...plan, exercises: (plan.exercises || []).map((exercise, index) => normalizeExercise({ ...exercise }, index, plan.id)) };
}
function newExercise(planId, index) {
  return normalizeExercise({ id: makeId("exercise"), name: "", type: "strength", sets: 3, reps: "10", duration: "15 min", distance: "3", distanceUnit: "km", notes: "" }, index, planId);
}
function targetForExercise(exercise) {
  if (exercise.type === "timed") return exercise.duration || "15 min";
  if (exercise.type === "distance") return `${exercise.distance || "3"} ${exercise.distanceUnit || "km"}`;
  return exercise.reps || "10";
}
function makeSession(plan, rotationIndex, isOverride = false) {
  const exercises = (plan.exercises || []).map((exercise, exerciseIndex) => {
    const item = normalizeExercise(exercise, exerciseIndex, plan.id);
    const setCount = item.type === "strength" ? item.sets : 1;
    return {
      ...item,
      id: makeId("session-exercise"),
      sets: Array.from({ length: setCount }, (_, setIndex) => ({
        id: makeId("set"),
        reps: targetForExercise(item),
        weight: item.type === "strength" ? item.targetWeight : "",
        done: false
      }))
    };
  });
  return {
    id: makeId("session"), planId: plan.id, planName: plan.name, planFocus: plan.focus,
    durationMinutes: plan.durationMinutes, rotationIndexAtStart: rotationIndex,
    usedOverride: isOverride, status: "active", startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), exercises
  };
}

function App() {
  const [page, setPage] = useState("home");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [appState, setAppState] = useState(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    readValue("state")
      .then(async (saved) => {
        if (cancelled) return;
        const migrated = migrateState(saved);
        setAppState(migrated);
        if (!saved || saved.schemaVersion !== INITIAL_STATE.schemaVersion) await writeValue("state", migrated);
      })
      .catch((error) => { if (!cancelled) setStorageError(error.message || "Local storage is unavailable."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded || storageError) return;
    writeValue("state", appState).catch((error) => setStorageError(error.message || "Could not save data."));
  }, [appState, loaded, storageError]);

  const plans = appState.masterPlans;
  const nextPlan = plans[appState.nextPlanIndex] || plans[0];
  const completedSessions = appState.sessions.filter((session) => session.status === "completed");
  const selectedMasterPlan = plans.find((plan) => plan.id === selectedPlanId);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }
  function startOrResumeWorkout() {
    if (appState.activeSession) { setPage("workout"); return; }
    const plan = appState.override || nextPlan;
    setAppState((current) => ({ ...current, activeSession: makeSession(plan, current.nextPlanIndex, Boolean(current.override)) }));
    setPage("workout");
  }
  function updateActiveSession(updater) {
    setAppState((current) => {
      if (!current.activeSession) return current;
      const updated = typeof updater === "function" ? updater(current.activeSession) : updater;
      return { ...current, activeSession: { ...updated, updatedAt: new Date().toISOString() } };
    });
  }
  function finishWorkout() {
    if (!appState.activeSession) return;
    const session = appState.activeSession;
    const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    const doneSets = session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.done).length, 0);
    if (!window.confirm(`Complete ${session.planName}?\n\n${doneSets} of ${totalSets} sets marked done. Confirming advances your normal rotation by one plan.`)) return;
    const completed = { ...session, status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setAppState((current) => ({
      ...current,
      nextPlanIndex: (session.rotationIndexAtStart + 1) % current.masterPlans.length,
      // A temporary next-workout plan is consumed whether it was completed or abandoned.
      override: session.usedOverride ? null : current.override,
      activeSession: null,
      sessions: [completed, ...current.sessions]
    }));
    setPage("progress");
    showNotice("Workout completed. Your rotation advanced by one plan.");
  }
  function abandonWorkout() {
    if (!appState.activeSession) return;
    if (!window.confirm("Abandon this session? Your rotation will not advance. This session's temporary workout edits will be discarded.")) return;
    const abandoned = { ...appState.activeSession, status: "abandoned", abandonedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setAppState((current) => ({
      ...current,
      activeSession: null,
      override: current.activeSession?.usedOverride ? null : current.override,
      sessions: [abandoned, ...current.sessions]
    }));
    setPage("home");
    showNotice("Session abandoned. Rotation unchanged; temporary workout edits discarded.");
  }
  function chooseOverride(plan) {
    if (appState.activeSession) { showNotice("Finish or abandon the active workout before customizing the next session."); return; }
    if (plan.id === nextPlan.id) {
      if (appState.override) {
        setAppState((current) => ({ ...current, override: null }));
        showNotice("One-time workout cleared. Your normal next plan is restored.");
      } else {
        showNotice("This is already your next plan in the normal rotation.");
      }
      return;
    }
    if (appState.override && appState.override.id === plan.id) {
      setAppState((current) => ({ ...current, override: null }));
      showNotice("One-time workout cleared. Your normal next plan is restored.");
      return;
    }
    const selected = clonePlan(plan);
    setAppState((current) => ({ ...current, override: { ...selected, sourcePlanId: plan.id, isCustomized: false, temporary: true } }));
    showNotice(`${plan.name} selected for the next session only.`);
    setPage("home");
  }
  function saveMasterPlan(updatedPlan) {
    const normalized = normalizePlan(updatedPlan, plans.findIndex((plan) => plan.id === updatedPlan.id));
    setAppState((current) => ({
      ...current,
      masterPlans: current.masterPlans.map((plan) => plan.id === normalized.id ? normalized : plan),
      // An uncustomized one-time selection follows master edits; a customized temporary
      // workout stays independent, and an active session is always its own snapshot.
      override: current.override?.sourcePlanId === normalized.id && !current.override.isCustomized
        ? { ...clonePlan(normalized), sourcePlanId: normalized.id, isCustomized: false, temporary: true }
        : current.override
    }));
    setPage("plans");
    showNotice("Master plan saved. Active workout snapshots are unchanged.");
  }
  function saveTemporaryWorkout(updatedPlan) {
    const sourcePlanId = updatedPlan.sourcePlanId || updatedPlan.id;
    setAppState((current) => ({ ...current, override: { ...normalizePlan(updatedPlan), sourcePlanId, isCustomized: true, temporary: true } }));
    setPage("home");
    showNotice("Temporary workout saved for the next session only.");
  }
  function openMasterEditor(planId) {
    setSelectedPlanId(planId);
    setPage("master-editor");
  }
  function openTemporaryEditor() {
    if (appState.activeSession) { showNotice("Finish or abandon the active workout before editing the next workout."); return; }
    setPage("next-editor");
  }

  if (!loaded) return <main className="loading-screen"><div className="brand-mark"><Activity /></div><p>Opening GymFlow…</p></main>;

  const nextWorkout = appState.override || nextPlan;
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><Activity size={21} /></div><div><div className="brand-name">GymFlow</div><div className="brand-subtitle">YOUR PERSONAL GYM COMPANION</div></div></div>
      <span className="local-pill"><span className="status-dot" /> Local</span>
    </header>
    {storageError && <div className="error-banner" role="alert"><ShieldCheck size={18} /><div><strong>Local storage issue</strong><p>{storageError} Your changes may not be saved.</p></div></div>}
    <main className="main-content">
      {page === "home" && <HomePage nextPlan={nextWorkout} normalNextPlan={nextPlan} hasActive={Boolean(appState.activeSession)} hasOverride={Boolean(appState.override)} onStart={startOrResumeWorkout} onNavigate={setPage} onCustomize={openTemporaryEditor} />}
      {page === "plans" && <PlansPage plans={plans} nextPlan={nextPlan} override={appState.override} hasActive={Boolean(appState.activeSession)} onEditMaster={openMasterEditor} onCustomize={openTemporaryEditor} onChooseOverride={chooseOverride} />}
      {page === "master-editor" && selectedMasterPlan && <PlanEditor key={`master-${selectedMasterPlan.id}`} plan={selectedMasterPlan} mode="master" onCancel={() => setPage("plans")} onSave={saveMasterPlan} />}
      {page === "next-editor" && <PlanEditor key={`temporary-${(appState.override || nextPlan).id}-${appState.override?.isCustomized ? "custom" : "normal"}`} plan={{ ...(appState.override || nextPlan), sourcePlanId: appState.override?.sourcePlanId || nextPlan.id }} mode="temporary" onCancel={() => setPage("home")} onSave={saveTemporaryWorkout} />}
      {page === "workout" && appState.activeSession && <WorkoutPage session={appState.activeSession} onBack={() => setPage("home")} onUpdate={updateActiveSession} onFinish={finishWorkout} onAbandon={abandonWorkout} />}
      {page === "workout" && !appState.activeSession && <HomePage nextPlan={nextWorkout} normalNextPlan={nextPlan} hasActive={false} hasOverride={Boolean(appState.override)} onStart={startOrResumeWorkout} onNavigate={setPage} onCustomize={openTemporaryEditor} />}
      {page === "progress" && <ProgressPage sessions={appState.sessions} completedSessions={completedSessions} />}
      {page === "settings" && <SettingsPage onNotice={showNotice} />}
    </main>
    {notice && <div className="toast" role="status">{notice}</div>}
    {!["workout", "master-editor", "next-editor"].includes(page) && <nav className="bottom-nav" aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => setPage(id)} aria-current={page === id ? "page" : undefined}><Icon size={21} strokeWidth={page === id ? 2.4 : 1.8} /><span>{label}</span></button>)}</nav>}
  </div>;
}

function HomePage({ nextPlan, normalNextPlan, hasActive, hasOverride, onStart, onNavigate, onCustomize }) {
  const planNumber = Number((normalNextPlan || nextPlan).id.split("-")[1]) || 1;
  return <div className="page-stack">
    <section className="welcome-row"><div><p className="eyebrow">YOUR NEXT SESSION</p><h1>Ready when<br />you are.</h1></div><div className="hero-icon"><Activity size={31} /></div></section>
    <section className="next-workout-card">
      <div className="card-topline"><span className="eyebrow">{hasOverride ? "ONE-TIME WORKOUT" : `UP NEXT · PLAN ${planNumber} OF ${normalNextPlan ? 5 : 5}`}</span><span className="plan-symbol"><Dumbbell size={18} /></span></div>
      <h2>{nextPlan.name}</h2><p className="muted plan-focus">{nextPlan.focus}</p>
      <div className="plan-meta"><span><CalendarDays size={15} /> {nextPlan.durationMinutes} min</span><span><Layers3 size={15} /> {nextPlan.exercises.length} activities</span></div>
      <div className="rotation-track" aria-label={`Next normal plan ${planNumber} of 5`}>{Array.from({ length: 5 }, (_, index) => <span key={index} className={`rotation-segment ${index === planNumber - 1 ? "current" : ""}`} />)}</div>
      {hasOverride && <div className="override-note"><Sparkles size={15} /> Temporary changes affect this session only</div>}
      {hasActive && <div className="active-note"><Activity size={15} /> Unfinished workout saved — resume where you left off</div>}
      <button className="button button-primary button-large" onClick={onStart}>{hasActive ? "Resume workout" : "Start workout"} <ChevronRight size={19} /></button>
      {!hasActive && <button className="button button-secondary button-large home-customize" onClick={onCustomize}><Sparkles size={17} /> Customize this workout</button>}
      <p className="card-footnote">Rotation advances only when you confirm a workout complete.</p>
    </section>
    <div className="quick-actions"><button className="quick-action" onClick={() => onNavigate("plans")}><span className="quick-icon"><Dumbbell size={19} /></span><span><strong>Manage plans</strong><small>Edit master plans or choose a one-time workout</small></span><ChevronRight size={18} /></button><button className="quick-action" onClick={() => onNavigate("progress")}><span className="quick-icon"><History size={19} /></span><span><strong>Workout history</strong><small>Review completed and abandoned sessions</small></span><ChevronRight size={18} /></button></div>
    <div className="info-strip"><WifiOff size={17} /><p><strong>Designed for the gym.</strong> Sessions and logs are saved on this device.</p></div>
  </div>;
}

function PlansPage({ plans, nextPlan, override, hasActive, onEditMaster, onCustomize, onChooseOverride }) {
  return <div className="page-stack">
    <div className="page-heading"><p className="eyebrow">YOUR ROUTINE</p><h1>Workout plans</h1><p className="muted">Master plans are permanent. A one-time workout is temporary.</p></div>
    <button className="button button-secondary button-large" onClick={onCustomize} disabled={hasActive}><Sparkles size={17} /> Customize next workout</button>
    {hasActive && <div className="info-strip"><CircleHelp size={17} /><p>You can still edit master plans, but changing the next workout is disabled while a session is active.</p></div>}
    <div className="plan-list">{plans.map((plan, index) => {
      const selected = override?.id === plan.id;
      const isNormalNext = !override && nextPlan.id === plan.id;
      return <article key={plan.id} className={`plan-list-card plan-select-card ${selected ? "selected" : ""}`}>
        <span className="plan-number">{index + 1}</span>
        <span className="plan-list-copy"><strong>{plan.name}</strong><small>{plan.focus}</small><small>{plan.durationMinutes} min · {plan.exercises.length} activities</small>{isNormalNext && <small className="tag-current">Normal next plan</small>}{selected && <small className="tag-current">Selected for next session</small>}</span>
        <div className="plan-card-actions"><button className="button button-secondary plan-edit-button" onClick={() => onEditMaster(plan.id)}>Edit</button><button className="button button-secondary plan-select-button" disabled={hasActive} onClick={() => onChooseOverride(plan)}>{isNormalNext ? "Next" : selected ? "Clear" : "Use once"}</button></div>
      </article>;
    })}</div>
    {override && <button className="button button-secondary button-large" onClick={() => onChooseOverride(nextPlan)} disabled={hasActive}><RotateCcw size={17} /> Clear temporary workout</button>}
    <div className="info-strip"><ShieldCheck size={17} /><p>Master edits are saved permanently. Temporary workout edits are discarded when the workout is completed or abandoned.</p></div>
  </div>;
}

function PlanEditor({ plan, mode, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...clonePlan(plan), sourcePlanId: plan.sourcePlanId || plan.id }));
  const [validation, setValidation] = useState("");
  const temporary = mode === "temporary";
  function updatePlan(field, value) { setDraft((current) => ({ ...current, [field]: value })); }
  function updateExercise(index, field, value) {
    setDraft((current) => ({ ...current, exercises: current.exercises.map((exercise, itemIndex) => itemIndex === index ? normalizeExercise({ ...exercise, [field]: value }, itemIndex, current.id) : exercise) }));
  }
  function addExercise() { setDraft((current) => ({ ...current, exercises: [...current.exercises, newExercise(current.id, current.exercises.length)] })); }
  function removeExercise(index) {
    const exercise = draft.exercises[index];
    if (!window.confirm(`Remove ${exercise.name || "this activity"}?`)) return;
    setDraft((current) => ({ ...current, exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index) }));
  }
  function moveExercise(index, direction) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.exercises.length) return current;
      const exercises = [...current.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...current, exercises };
    });
  }
  function save() {
    const name = draft.name.trim();
    if (!name) { setValidation("Give this plan a name before saving."); return; }
    if (!draft.exercises.length) { setValidation("Add at least one activity before saving."); return; }
    if (draft.exercises.some((exercise) => !exercise.name.trim())) { setValidation("Every activity needs a name, or remove the empty activity."); return; }
    const normalized = normalizePlan({ ...draft, name, focus: draft.focus.trim(), exercises: draft.exercises.map((exercise, index) => normalizeExercise(exercise, index, draft.id)) });
    onSave({ ...normalized, sourcePlanId: draft.sourcePlanId || draft.id, isCustomized: temporary ? true : undefined, temporary: temporary || undefined });
  }
  return <div className="page-stack editor-page">
    <button className="back-button" onClick={onCancel}><ChevronLeft size={18} /> Cancel and go back</button>
    <div className="page-heading"><p className="eyebrow">{temporary ? "ONE-TIME EDITOR" : "MASTER PLAN EDITOR"}</p><h1>{temporary ? "Customize next workout" : "Edit master plan"}</h1><p className="muted">{temporary ? "Changes apply to this next session only. The master plan stays untouched." : "Changes are saved permanently for future sessions. An active workout keeps its existing snapshot."}</p></div>
    <section className="editor-panel">
      <label className="field-label">Plan name<input value={draft.name} onChange={(event) => updatePlan("name", event.target.value)} placeholder="e.g. Lower Body" /></label>
      <label className="field-label">Focus / description<input value={draft.focus} onChange={(event) => updatePlan("focus", event.target.value)} placeholder="e.g. Legs and stability" /></label>
      <label className="field-label">Estimated duration (minutes)<input type="number" min="1" max="600" value={draft.durationMinutes} onChange={(event) => updatePlan("durationMinutes", event.target.value)} /></label>
    </section>
    <div className="editor-section-heading"><div><h2>Activities</h2><p>{draft.exercises.length} in this workout · drag-free move controls</p></div></div>
    {draft.exercises.map((exercise, index) => <section className="editor-exercise-card" key={exercise.id}>
      <div className="editor-exercise-top"><span className="exercise-index">{String(index + 1).padStart(2, "0")}</span><div className="editor-reorder"><button aria-label={`Move ${exercise.name || "activity"} up`} className="icon-button" disabled={index === 0} onClick={() => moveExercise(index, -1)}><ArrowUp size={17} /></button><button aria-label={`Move ${exercise.name || "activity"} down`} className="icon-button" disabled={index === draft.exercises.length - 1} onClick={() => moveExercise(index, 1)}><ArrowDown size={17} /></button><button aria-label={`Delete ${exercise.name || "activity"}`} className="icon-button danger-button" onClick={() => removeExercise(index)}><Trash2 size={17} /></button></div></div>
      <label className="field-label">Activity name<input value={exercise.name} onChange={(event) => updateExercise(index, "name", event.target.value)} placeholder="e.g. Leg press, running, cycling" /></label>
      <label className="field-label">Activity type<select value={exercise.type} onChange={(event) => updateExercise(index, "type", event.target.value)}><option value="strength">Strength / reps</option><option value="timed">Timed activity</option><option value="distance">Distance-based activity</option></select></label>
      {exercise.type === "strength" && <div className="field-grid three-fields"><label className="field-label">Sets<input type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateExercise(index, "sets", event.target.value)} /></label><label className="field-label">Reps per set<input value={exercise.reps} onChange={(event) => updateExercise(index, "reps", event.target.value)} placeholder="10" /></label><label className="field-label">Target weight<input value={exercise.targetWeight} onChange={(event) => updateExercise(index, "targetWeight", event.target.value)} placeholder="e.g. 20 kg" /></label></div>}
      {exercise.type === "timed" && <label className="field-label">Target duration<input value={exercise.duration} onChange={(event) => updateExercise(index, "duration", event.target.value)} placeholder="e.g. 20 min or 30 sec" /></label>}
      {exercise.type === "distance" && <div className="field-grid"><label className="field-label">Target distance<input value={exercise.distance} onChange={(event) => updateExercise(index, "distance", event.target.value)} placeholder="3" /></label><label className="field-label">Unit<select value={exercise.distanceUnit} onChange={(event) => updateExercise(index, "distanceUnit", event.target.value)}><option value="km">Kilometres (km)</option><option value="mi">Miles (mi)</option><option value="m">Metres (m)</option></select></label></div>}
      <label className="field-label">Notes (optional)<textarea value={exercise.notes} onChange={(event) => updateExercise(index, "notes", event.target.value)} rows="2" placeholder="Form cues, alternatives, pace, equipment…" /></label>
    </section>)}
    <div className="editor-section-heading" style={{ display: "flex", justifyContent: "flex-end" }}><button className="button button-secondary add-activity-button" onClick={addExercise}><Plus size={16} /> Add activity</button></div>
    {validation && <div className="validation-message" role="alert">{validation}</div>}
    <div className="editor-footer"><button className="button button-primary button-large" onClick={save}><Check size={18} /> {temporary ? "Save temporary workout" : "Save master plan"}</button><button className="button button-secondary button-large" onClick={onCancel}><X size={17} /> Cancel</button></div>
    <p className="editor-footnote">{temporary ? "This custom version is discarded after the next workout is completed or abandoned. Cancel leaves the current plan unchanged." : "Reordering, adding, editing or deleting activities affects the master plan only. An active workout is not modified."}</p>
  </div>;
}

function WorkoutPage({ session, onBack, onUpdate, onFinish, onAbandon }) {
  const totalSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const doneSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
  const progress = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  function updateSet(exerciseId, setId, field, value) {
    onUpdate((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : ({ ...exercise, sets: exercise.sets.map((set) => set.id !== setId ? set : ({ ...set, [field]: value })) })) }));
  }
  return <div className="page-stack workout-page">
    <button className="back-button" onClick={onBack}><ChevronLeft size={18} /> Back to home</button>
    <div className="page-heading"><p className="eyebrow">{session.usedOverride ? "ONE-TIME SESSION SNAPSHOT" : "WORKOUT IN PROGRESS"}</p><h1>{session.planName}</h1><p className="muted">{session.planFocus}</p></div>
    <section className="session-progress-card"><div className="session-progress-head"><span>{doneSets} of {totalSets} sets checked</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small>Your workout is a snapshot. Master-plan edits won't change this active session.</small></section>
    {session.exercises.map((exercise, exerciseIndex) => {
      const isStrength = exercise.type !== "timed" && exercise.type !== "distance";
      const targetLabel = exercise.type === "timed" ? "Time" : exercise.type === "distance" ? "Distance" : "Reps";
      return <section key={exercise.id} className="exercise-card">
        <div className="exercise-heading"><span className="exercise-index">{String(exerciseIndex + 1).padStart(2, "0")}</span><div><h2>{exercise.name}</h2><p>{exercise.sets.filter((set) => set.done).length}/{exercise.sets.length} sets complete · {exercise.type === "strength" ? "Strength" : exercise.type === "timed" ? "Timed activity" : "Distance activity"}</p>{exercise.notes && <p className="exercise-notes">{exercise.notes}</p>}</div></div>
        <div className={`sets-header ${isStrength ? "strength-grid" : "cardio-grid"}`}><span>Set</span><span>{targetLabel} / actual</span>{isStrength && <span>Weight</span>}<span>Done</span></div>
        {exercise.sets.map((set, setIndex) => <div key={set.id} className={`set-row ${isStrength ? "strength-grid" : "cardio-grid"} ${set.done ? "set-complete" : ""}`}><span className="set-index">{setIndex + 1}</span><input aria-label={`${exercise.name} set ${setIndex + 1} ${targetLabel.toLowerCase()}`} value={set.reps} onChange={(event) => updateSet(exercise.id, set.id, "reps", event.target.value)} />{isStrength && <input aria-label={`${exercise.name} set ${setIndex + 1} weight`} inputMode="decimal" placeholder="kg" value={set.weight} onChange={(event) => updateSet(exercise.id, set.id, "weight", event.target.value)} />}<input className="set-checkbox" aria-label={`${exercise.name} set ${setIndex + 1} complete`} type="checkbox" checked={set.done} onChange={(event) => updateSet(exercise.id, set.id, "done", event.target.checked)} /></div>)}
      </section>;
    })}
    <div className="session-actions"><button className="button button-primary button-large" onClick={onFinish}><CheckCircle2 size={18} /> Confirm workout complete</button><button className="button button-secondary button-large" onClick={onAbandon}><PauseCircle size={18} /> Abandon session</button><p>Completing advances rotation once. Abandoning keeps rotation unchanged and discards temporary edits.</p></div>
  </div>;
}

function ProgressPage({ sessions, completedSessions }) {
  const recentSessions = useMemo(() => sessions.slice().sort((a, b) => new Date(b.completedAt || b.abandonedAt || b.startedAt) - new Date(a.completedAt || a.abandonedAt || a.startedAt)), [sessions]);
  return <div className="page-stack"><div className="page-heading"><p className="eyebrow">YOUR JOURNEY</p><h1>Progress</h1><p className="muted">A record of your workouts, not just perfect days.</p></div><section className="stat-grid"><div className="stat-card"><span className="stat-icon"><CheckCircle2 size={19} /></span><strong>{completedSessions.length}</strong><small>Completed workouts</small></div><div className="stat-card"><span className="stat-icon"><Activity size={19} /></span><strong>{sessions.length}</strong><small>Recorded sessions</small></div></section>{recentSessions.length === 0 ? <section className="empty-state"><div className="empty-icon"><History size={27} /></div><h2>No workout history yet</h2><p>Your completed and abandoned sessions will appear here.</p></section> : <section className="history-list"><h2>Recent sessions</h2>{recentSessions.map((session) => <article className="history-card" key={session.id}><div className={`history-status ${session.status}`}>{session.status === "completed" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</div><div className="history-copy"><strong>{session.planName}</strong><small>{new Date(session.completedAt || session.abandonedAt || session.startedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small><small>{session.status === "completed" ? "Completed" : "Abandoned"}{session.usedOverride ? " · one-time choice" : ""}</small></div><span className={`status-label ${session.status}`}>{session.status}</span></article>)}</section>}</div>;
}
function SettingsPage({ onNotice }) {
  return <div className="page-stack"><div className="page-heading"><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Your app, your routine.</p></div><section className="settings-card"><div className="settings-row"><span className="settings-icon"><ShieldCheck size={19} /></span><span><strong>Local-first storage</strong><small>Your workout data stays on this device in v1.</small></span><span className="settings-status">On</span></div><div className="settings-row"><span className="settings-icon"><Activity size={19} /></span><span><strong>Appearance</strong><small>Dark green theme</small></span></div><div className="settings-row"><span className="settings-icon"><History size={19} /></span><span><strong>Backup and restore</strong><small>Export and import will be added in a later stage.</small></span><ChevronRight size={18} /></div></section><button className="button button-secondary button-large" onClick={() => onNotice("GymFlow · master plan and temporary workout editors, sessions and rotation.")}>View app information</button><p className="version-note">GymFlow · Stage 2.1 · v0.3.0</p></div>;
}

export default App;
