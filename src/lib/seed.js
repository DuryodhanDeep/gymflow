export const starterPlans = [
  { id: "plan-1", name: "Upper Body A", focus: "Chest, back, shoulders and triceps", durationMinutes: 55 },
  { id: "plan-2", name: "Lower Body", focus: "Legs and stability", durationMinutes: 50 },
  { id: "plan-3", name: "Cardio + Core", focus: "Endurance and core stability", durationMinutes: 45 },
  { id: "plan-4", name: "Upper Body B", focus: "Back, chest, biceps and shoulders", durationMinutes: 55 },
  { id: "plan-5", name: "Full Body", focus: "Balanced strength and easy cardio", durationMinutes: 55 }
];

export const EXERCISES_BY_PLAN = {
  "plan-1": ["Machine chest press", "Lat pulldown", "Seated cable row", "Dumbbell shoulder press", "Triceps pushdown"],
  "plan-2": ["Leg press", "Seated leg curl", "Leg extension", "Standing calf raise", "Bodyweight glute bridge"],
  "plan-3": ["Treadmill walk", "Stationary bike", "Dead bug", "Bird dog", "Plank"],
  "plan-4": ["Seated cable row", "Incline chest press", "Lat pulldown", "Dumbbell biceps curl", "Lateral raise"],
  "plan-5": ["Goblet squat", "Machine chest press", "Seated cable row", "Dumbbell Romanian deadlift", "Easy stationary bike"]
};

function inferType(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("plank")) return "timed";
  if (["treadmill", "bike", "cycling", "running", "walk", "elliptical", "cross-trainer", "swimming", "rowing machine"].some((word) => value.includes(word))) return "timed";
  return "strength";
}

export function normalizeExercise(exercise, index = 0, planId = "plan") {
  if (typeof exercise === "string") exercise = { name: exercise };
  const item = exercise && typeof exercise === "object" ? exercise : {};
  const type = ["strength", "timed", "distance"].includes(item.type) ? item.type : inferType(item.name);
  return {
    id: item.id || `${planId}-exercise-${index + 1}`,
    name: String(item.name || ""),
    type,
    sets: Math.max(1, Math.min(20, Number.parseInt(item.sets, 10) || 3)),
    reps: String(item.reps ?? "10"),
    targetWeight: String(item.targetWeight ?? ""),
    duration: String(item.duration ?? (String(item.name || "").toLowerCase().includes("plank") ? "30 sec" : "15 min")),
    distance: String(item.distance ?? "3"),
    distanceUnit: ["km", "mi", "m"].includes(item.distanceUnit) ? item.distanceUnit : "km",
    notes: String(item.notes ?? "")
  };
}

export function normalizePlan(plan, index = 0) {
  const source = plan && typeof plan === "object" ? plan : {};
  const id = source.id || `plan-${index + 1}`;
  let rawExercises = Array.isArray(source.exercises) ? source.exercises : EXERCISES_BY_PLAN[id];
  if (!Array.isArray(rawExercises)) rawExercises = EXERCISES_BY_PLAN[id] || ["Warm-up", "Main exercise", "Cool-down"];
  return {
    id,
    name: String(source.name || `Plan ${index + 1}`),
    focus: String(source.focus || "Personal workout"),
    durationMinutes: Math.max(1, Number.parseInt(source.durationMinutes, 10) || 45),
    exercises: rawExercises.map((exercise, exerciseIndex) => normalizeExercise(exercise, exerciseIndex, id))
  };
}

export const INITIAL_STATE = {
  schemaVersion: 3,
  nextPlanIndex: 0,
  masterPlans: starterPlans.map((plan, index) => normalizePlan(plan, index)),
  override: null,
  activeSession: null,
  sessions: []
};

// Migrate both the Stage 1 metadata-only plans and Stage 2 sessions without
// changing the active workout snapshot or the rotation pointer.
export function migrateState(saved) {
  if (!saved || typeof saved !== "object") return INITIAL_STATE;
  const rawPlans = Array.isArray(saved.masterPlans) && saved.masterPlans.length ? saved.masterPlans : starterPlans;
  const masterPlans = rawPlans.map((plan, index) => normalizePlan(plan, index));
  const rawIndex = Number.isInteger(saved.nextPlanIndex) ? saved.nextPlanIndex : 0;
  const rawOverride = saved.override && typeof saved.override === "object" ? saved.override : null;
  return {
    ...INITIAL_STATE,
    ...saved,
    schemaVersion: 3,
    nextPlanIndex: ((rawIndex % masterPlans.length) + masterPlans.length) % masterPlans.length,
    masterPlans,
    override: rawOverride ? {
      ...normalizePlan(rawOverride, masterPlans.findIndex((plan) => plan.id === rawOverride.id)),
      sourcePlanId: rawOverride.sourcePlanId || rawOverride.id,
      isCustomized: Boolean(rawOverride.isCustomized),
      temporary: true
    } : null,
    // Session exercises already contain their own logged sets. Keep them as-is.
    activeSession: saved.activeSession ?? null,
    sessions: Array.isArray(saved.sessions) ? saved.sessions : []
  };
}
