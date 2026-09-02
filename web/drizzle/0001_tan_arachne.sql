CREATE INDEX `idx_oauth_states_expiry` ON `oauth_states` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);