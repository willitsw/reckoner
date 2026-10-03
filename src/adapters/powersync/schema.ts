import { column, Schema, Table } from '@powersync/common';

/**
 * Client SQLite schema for PowerSync. Matches .plans/powersync-spike.md.
 * Shared by process + run (+ future media) adapters. `id` is provided by the SDK.
 */
const profiles = new Table({
  display_name: column.text,
  plan: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const processes = new Table({
  owner_id: column.text,
  created_by: column.text,
  updated_by: column.text,
  title: column.text,
  notes: column.text,
  pinned_at: column.text,
  archived_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const steps = new Table({
  process_id: column.text,
  owner_id: column.text,
  created_by: column.text,
  updated_by: column.text,
  position: column.text,
  kind: column.text,
  optional: column.integer,
  body: column.text,
  notes: column.text,
  url: column.text,
  child_process_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const media_assets = new Table({
  owner_id: column.text,
  created_by: column.text,
  updated_by: column.text,
  process_id: column.text,
  step_id: column.text,
  kind: column.text,
  storage_path: column.text,
  content_type: column.text,
  byte_size: column.integer,
  caption: column.text,
  position: column.text,
  is_cover: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const runs = new Table({
  owner_id: column.text,
  created_by: column.text,
  updated_by: column.text,
  process_id: column.text,
  status: column.text,
  started_at: column.text,
  completed_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const run_checks = new Table({
  owner_id: column.text,
  created_by: column.text,
  updated_by: column.text,
  run_id: column.text,
  step_id: column.text,
  occurrence_path: column.text,
  checked_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

export const AppSchema = new Schema({
  profiles,
  processes,
  steps,
  media_assets,
  runs,
  run_checks,
});

export type AppDatabase = (typeof AppSchema)['types'];
