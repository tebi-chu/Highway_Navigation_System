CREATE TABLE IF NOT EXISTS facility_overrides (
  point_id TEXT PRIMARY KEY,
  road_id TEXT NOT NULL,
  facilities_json TEXT NOT NULL,
  brands_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS facility_overrides_road_id
ON facility_overrides(road_id);

CREATE TABLE IF NOT EXISTS anonymous_edit_limits (
  fingerprint TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  edit_count INTEGER NOT NULL,
  PRIMARY KEY (fingerprint, window_start)
);
