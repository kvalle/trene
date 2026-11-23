export const SCHEMA_VERSION = 2;

export const DEFAULT_TRAINING_CONTEXT_NAME = 'Standard';

/** Schema version 1. Historical and immutable; fixture scripts read this literal. */
export const VERSION_ONE_SQL = `
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (
    (status = 'active' AND completed_at IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX one_active_workout
  ON workouts (status) WHERE status = 'active';

CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (workout_id, exercise_id),
  UNIQUE (workout_id, position)
);

CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL
    REFERENCES workout_exercises(id) ON DELETE CASCADE,
  load_kg REAL,
  repetitions INTEGER,
  confirmed_at TEXT,
  CHECK (
    load_kg IS NULL OR
    (load_kg >= 0 AND load_kg <= 999.9 AND load_kg * 10 = CAST(load_kg * 10 AS INTEGER))
  ),
  CHECK (
    repetitions IS NULL OR
    (typeof(repetitions) = 'integer' AND repetitions >= 1 AND repetitions <= 999)
  ),
  CHECK (
    confirmed_at IS NULL OR
    (load_kg IS NOT NULL AND repetitions IS NOT NULL)
  )
);
`;

const TRAINING_CONTEXTS_SQL = `
CREATE TABLE training_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL
);
`;

const VERSION_TWO_WORKOUTS_SQL = `
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_context_id INTEGER NOT NULL
    REFERENCES training_contexts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK (
    (status = 'active' AND completed_at IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL)
  )
);
`;

const ONE_ACTIVE_WORKOUT_SQL = `
CREATE UNIQUE INDEX one_active_workout
  ON workouts (status) WHERE status = 'active';
`;

/**
 * The exact schema objects of schema version 2, used by inspection: schema 1
 * with kontekster and a required kontekst on every treningsøkt.
 */
export const VERSION_TWO_SQL = TRAINING_CONTEXTS_SQL
  + VERSION_ONE_SQL.replace(/\nCREATE TABLE workouts \([\s\S]*?\n\);\n/u, VERSION_TWO_WORKOUTS_SQL);

/**
 * Creates the schema 2 tables next to the renamed schema 1 workouts table.
 * Must run with foreign-key enforcement off and `legacy_alter_table` on, so
 * that renaming `workouts` leaves references from `workout_exercises` intact.
 */
export const MIGRATE_ONE_TO_TWO_CREATE_SQL = `
ALTER TABLE workouts RENAME TO workouts_v1;
${TRAINING_CONTEXTS_SQL}
${VERSION_TWO_WORKOUTS_SQL}
`;

export const MIGRATE_ONE_TO_TWO_FINISH_SQL = `
DROP TABLE workouts_v1;
${ONE_ACTIVE_WORKOUT_SQL}
`;

export const SCHEMA_SQL_BY_VERSION: Readonly<Record<number, string>> = {
  1: VERSION_ONE_SQL,
  2: VERSION_TWO_SQL,
};

export const AUTHORITATIVE_TABLES_BY_VERSION: Readonly<Record<number, readonly string[]>> = {
  1: ['exercises', 'workouts', 'workout_exercises', 'workout_sets'],
  2: ['training_contexts', 'exercises', 'workouts', 'workout_exercises', 'workout_sets'],
};
