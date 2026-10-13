import { migrateState } from "./seed.js";

export const BACKUP_FORMAT = "gymflow-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 15 * 1024 * 1024;

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validSession = (session, status) => record(session) && typeof session.id === "string" &&
  session.status === status && Array.isArray(session.exercises) &&
  session.exercises.every((exercise) => record(exercise) && typeof exercise.name === "string" &&
    Array.isArray(exercise.sets) && exercise.sets.every((set) => record(set) && typeof set.id === "string" && typeof set.done === "boolean"));

export function createBackup(state) {
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state
  };
}

export function parseBackup(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) {
    throw new Error("Backup is too large (15 MB maximum).");
  }
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (!record(backup) || backup.format !== BACKUP_FORMAT || backup.backupVersion !== BACKUP_VERSION) {
    throw new Error("This is not a supported GymFlow backup file.");
  }
  const state = backup.state;
  if (!record(state) || !Number.isInteger(state.schemaVersion) || state.schemaVersion < 1 || state.schemaVersion > 3) {
    throw new Error("Backup data uses an unsupported app schema.");
  }
  if (!Array.isArray(state.masterPlans) || state.masterPlans.length !== 5 ||
      state.masterPlans.some((p) => !record(p) || typeof p.id !== "string" || !p.id || typeof p.name !== "string" || !p.name.trim() || !Array.isArray(p.exercises) || !p.exercises.length || p.exercises.some((e) => !(typeof e === "string" || (record(e) && typeof e.name === "string" && e.name.trim())))) ||
      new Set(state.masterPlans.map((p) => p.id)).size !== 5) {
    throw new Error("Backup must contain five valid master plans with activities.");
  }
  if (!Number.isInteger(state.nextPlanIndex) || state.nextPlanIndex < 0 || state.nextPlanIndex >= 5 ||
      !Array.isArray(state.sessions) ||
      state.sessions.some((s) => !["completed", "abandoned"].some((status) => validSession(s, status))) ||
      (state.activeSession !== null && !validSession(state.activeSession, "active")) ||
      (state.override !== null && (!record(state.override) || !Array.isArray(state.override.exercises)))) {
    throw new Error("Backup contains invalid rotation or session data.");
  }
  const migrated = migrateState(state);
  return {
    state: migrated,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : null,
    summary: {
      plans: migrated.masterPlans.length,
      sessions: migrated.sessions.length,
      active: Boolean(migrated.activeSession),
      temporary: Boolean(migrated.override)
    }
  };
}
