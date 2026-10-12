export const starterPlans = [
  { id: "plan-1", name: "Upper Body A", focus: "Chest, back, shoulders and triceps", durationMinutes: 55, exercises: 5 },
  { id: "plan-2", name: "Lower Body", focus: "Legs and stability", durationMinutes: 50, exercises: 5 },
  { id: "plan-3", name: "Cardio + Core", focus: "Endurance and core stability", durationMinutes: 45, exercises: 5 },
  { id: "plan-4", name: "Upper Body B", focus: "Back, chest, biceps and shoulders", durationMinutes: 55, exercises: 5 },
  { id: "plan-5", name: "Full Body", focus: "Balanced strength and easy cardio", durationMinutes: 55, exercises: 5 }
];

export const INITIAL_STATE = {
  schemaVersion: 1,
  nextPlanIndex: 0,
  masterPlans: starterPlans,
  override: null,
  activeSession: null,
  sessions: []
};
