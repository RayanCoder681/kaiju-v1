ALTER TABLE session_activity ADD COLUMN sequence_id TEXT;
CREATE INDEX idx_session_activity_sequence ON session_activity(sequence_id, state, position);
