-- Production-oriented PostgreSQL model for ReconLab.
-- The hosted portfolio demo uses an in-memory adapter so it can be explored
-- without external credentials. This schema documents the durable adapter.

create type payment_status as enum ('initiated', 'processing', 'successful', 'failed', 'reversed');
create type ledger_status as enum ('pending', 'posted', 'reversed');
create type case_status as enum ('open', 'investigating', 'resolved');
create type case_severity as enum ('critical', 'high', 'medium', 'low');

create table provider_events (
  id uuid primary key,
  event_id text not null,
  provider text not null,
  external_reference text not null,
  merchant_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status payment_status not null,
  raw_payload jsonb not null,
  payload_sha256 char(64) not null,
  signature_verified boolean not null default false,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index provider_events_external_reference_idx
  on provider_events (provider, external_reference);

create index provider_events_reconciliation_scan_idx
  on provider_events (received_at, status);

create table ledger_entries (
  id uuid primary key,
  external_reference text not null,
  merchant_reference text not null,
  amount_minor bigint not null,
  currency char(3) not null,
  status ledger_status not null,
  account text not null,
  entry_kind text not null check (entry_kind in ('payment', 'reversal', 'adjustment')),
  compensates_entry_id uuid references ledger_entries(id),
  posted_at timestamptz not null default now(),
  unique (external_reference, entry_kind)
);

create index ledger_entries_merchant_reference_idx
  on ledger_entries (merchant_reference);

create table reconciliation_runs (
  id uuid primary key,
  started_at timestamptz not null,
  completed_at timestamptz,
  provider_records integer not null default 0,
  ledger_records integer not null default 0,
  matched_records integer not null default 0,
  exception_records integer not null default 0,
  status text not null,
  ruleset_version text not null
);

create table reconciliation_cases (
  id uuid primary key,
  run_id uuid not null references reconciliation_runs(id),
  type text not null,
  severity case_severity not null,
  status case_status not null default 'open',
  provider text not null,
  external_reference text not null,
  merchant_reference text not null,
  expected_minor bigint,
  observed_minor bigint,
  currency char(3) not null,
  summary text not null,
  recommendation text not null,
  attempts integer not null default 0,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (type, provider, external_reference, status)
);

create table audit_events (
  sequence_id bigserial primary key,
  id uuid not null unique,
  action text not null,
  actor text not null,
  target text not null,
  detail jsonb not null,
  outcome text not null,
  previous_event_hash char(64),
  event_hash char(64) not null,
  occurred_at timestamptz not null default now()
);

-- Application roles should receive only the permissions required by the
-- active service. The reconciliation reader cannot mutate provider evidence.
create role recon_reader nologin;
grant select on provider_events, ledger_entries to recon_reader;

create role recon_worker nologin;
grant select on provider_events, ledger_entries to recon_worker;
grant select, insert, update on reconciliation_runs, reconciliation_cases to recon_worker;

create role ledger_recovery_writer nologin;
grant select, insert on ledger_entries to ledger_recovery_writer;
grant select, insert on audit_events to ledger_recovery_writer;
