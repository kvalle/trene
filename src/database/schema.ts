export const SCHEMA_VERSION = 1;

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
