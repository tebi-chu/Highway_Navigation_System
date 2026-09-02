import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  pinHash: text('pin_hash'),
  pinSalt: text('pin_salt'),
  pinIterations: integer('pin_iterations'),
  pinRevision: integer('pin_revision').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  kind: text('kind').notNull(),
  email: text('email'),
  pinRevision: integer('pin_revision'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_sessions_expiry').on(table.expiresAt)]);

export const pinLimits = sqliteTable('pin_limits', {
  identifierHash: text('identifier_hash').primaryKey(),
  failureCount: integer('failure_count').notNull(),
  windowStartedAt: integer('window_started_at').notNull(),
  lockedUntil: integer('locked_until').notNull().default(0),
});

export const oauthStates = sqliteTable('oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  verifier: text('verifier').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('idx_oauth_states_expiry').on(table.expiresAt)]);

export const trafficLimits = sqliteTable('traffic_limits', {
  identifierHash: text('identifier_hash').primaryKey(),
  lastRequestAt: integer('last_request_at').notNull(),
});
