-- ════════════════════════════════════════════════════════════════════════════
-- Dart-app (persoonlijk) — eigen schema "dartapp", volledig los van de competitie.
--
--  * Raakt GEEN bestaande tabel aan. Enige uitzonderingen: de extensie pgcrypto
--    (voor wachtwoord-hashes) en functies met het voorvoegsel public.dartapp_
--  * Eigen inlog (gebruikersnaam + wachtwoord), géén Supabase-accounts, zodat
--    nieuwe spelers nooit in auth.users terechtkomen.
--  * Tabellen hebben RLS aan zonder policies: de app kan er niet rechtstreeks bij,
--    alleen via de dartapp_* functies, en die geven alleen de eigen data terug.
--  * Verwijderen van alles: zie 002_uninstall.sql
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;
create schema if not exists dartapp;
revoke all on schema dartapp from public, anon, authenticated;

create table dartapp.settings (key text primary key, value text not null);
create table dartapp.users (
  id           uuid primary key default gen_random_uuid(),
  username     text not null unique check (username = lower(username) and length(username) between 2 and 32),
  display_name text not null check (length(display_name) between 1 and 40),
  pw_hash      text not null,
  created_at   timestamptz not null default now()
);
create table dartapp.sessions (
  token_hash text primary key,
  user_id    uuid not null references dartapp.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create table dartapp.login_attempts (
  id bigserial primary key, username text not null, ok boolean not null, at timestamptz not null default now()
);
create index on dartapp.login_attempts (username, at);

create table dartapp.games (
  id            uuid primary key,
  user_id       uuid not null references dartapp.users(id) on delete cascade,
  kind          text not null check (kind in ('x01','cricket','around_clock','bobs27','doubles','shanghai')),
  mode          text not null check (mode in ('solo','pvp','bot')),
  config        jsonb not null default '{}',
  opponent_name text,
  bot_level     integer check (bot_level between 1 and 10),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  result        text check (result in ('won','lost','draw','solo')),
  summary       jsonb not null default '{}'
);
create index on dartapp.games (user_id, started_at desc);

create table dartapp.turns (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references dartapp.games(id) on delete cascade,
  user_id          uuid not null references dartapp.users(id) on delete cascade,
  seq              integer not null check (seq >= 1),
  leg_number       integer not null default 1,
  side             text not null check (side in ('me','opp')),
  input_mode       text not null default 'total' check (input_mode in ('total','darts')),
  score            integer not null default 0,
  remaining_before integer,
  remaining_after  integer,
  darts_thrown     integer not null default 3 check (darts_thrown between 0 and 3),
  is_bust          boolean not null default false,
  is_checkout      boolean not null default false,
  input            jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  unique (game_id, seq)
);
create index on dartapp.turns (user_id);

create table dartapp.darts (
  turn_id          uuid not null references dartapp.turns(id) on delete cascade,
  dart_index       smallint not null check (dart_index between 1 and 3),
  multiplier       smallint not null check (multiplier between 0 and 3),
  segment          smallint not null check (segment between 0 and 25),
  points           smallint not null check (points between 0 and 60),
  remaining_before integer,
  double_target    smallint check (double_target between 1 and 25),
  double_hit       boolean,
  primary key (turn_id, dart_index)
);

alter table dartapp.settings       enable row level security;
alter table dartapp.users          enable row level security;
alter table dartapp.sessions       enable row level security;
alter table dartapp.login_attempts enable row level security;
alter table dartapp.games          enable row level security;
alter table dartapp.turns          enable row level security;
alter table dartapp.darts          enable row level security;
revoke all on all tables in schema dartapp from public, anon, authenticated;

-- ── Hulpfuncties (niet bereikbaar voor de app) ──────────────────────────────
create function dartapp.sha(t text) returns text language sql immutable as
$$ select encode(extensions.digest(convert_to(t, 'utf8'), 'sha256'), 'hex') $$;

create function dartapp.auth_user(p_token text) returns uuid
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare u uuid;
begin
  select user_id into u from dartapp.sessions
   where token_hash = dartapp.sha(coalesce(p_token, '')) and expires_at > now();
  if u is null then raise exception 'Je bent uitgelogd. Log opnieuw in.' using errcode = 'P0001'; end if;
  return u;
end $$;

create function dartapp.new_session(p_user uuid) returns text
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare tok text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from dartapp.sessions where expires_at < now();
  insert into dartapp.sessions (token_hash, user_id) values (dartapp.sha(tok), p_user);
  return tok;
end $$;

-- ── Inloggen ────────────────────────────────────────────────────────────────
create function public.dartapp_register(p_username text, p_password text, p_display_name text, p_invite text default null)
returns jsonb language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare uname text := lower(trim(p_username)); u dartapp.users; need text;
begin
  select value into need from dartapp.settings where key = 'invite_code';
  if need is not null and coalesce(p_invite, '') <> need then raise exception 'Uitnodigingscode klopt niet.'; end if;
  if length(uname) < 2 or length(uname) > 32 then raise exception 'Gebruikersnaam: 2 tot 32 tekens.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Wachtwoord: minimaal 6 tekens.'; end if;
  if exists (select 1 from dartapp.users where username = uname) then raise exception 'Die gebruikersnaam is al in gebruik.'; end if;
  insert into dartapp.users (username, display_name, pw_hash)
  values (uname, left(coalesce(nullif(trim(p_display_name), ''), uname), 40), extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  returning * into u;
  return jsonb_build_object('token', dartapp.new_session(u.id), 'user', jsonb_build_object('username', u.username, 'displayName', u.display_name));
end $$;

create function public.dartapp_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare uname text := lower(trim(p_username)); u dartapp.users; fails int;
begin
  select count(*) into fails from dartapp.login_attempts where username = uname and not ok and at > now() - interval '15 minutes';
  if fails >= 5 then raise exception 'Te veel pogingen. Probeer het over 15 minuten opnieuw.'; end if;
  select * into u from dartapp.users where username = uname;
  if not found or u.pw_hash <> extensions.crypt(coalesce(p_password, ''), u.pw_hash) then
    insert into dartapp.login_attempts (username, ok) values (uname, false);
    raise exception 'Gebruikersnaam of wachtwoord klopt niet.';
  end if;
  delete from dartapp.login_attempts where username = uname;
  return jsonb_build_object('token', dartapp.new_session(u.id), 'user', jsonb_build_object('username', u.username, 'displayName', u.display_name));
end $$;

create function public.dartapp_logout(p_token text) returns void
language sql security definer set search_path = dartapp, extensions, pg_temp as
$$ delete from dartapp.sessions where token_hash = dartapp.sha(coalesce(p_token, '')) $$;

create function public.dartapp_me(p_token text) returns jsonb
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare u dartapp.users;
begin
  select * into u from dartapp.users where id = dartapp.auth_user(p_token);
  return jsonb_build_object('username', u.username, 'displayName', u.display_name);
end $$;

-- ── Spel opslaan (idempotent: hele spel + beurten in één keer) ──────────────
-- p_game:  { id, kind, mode, config, opponentName, botLevel, startedAt, finishedAt, result, summary }
-- p_turns: [{ id?, seq, legNumber, side, mode, score, remainingBefore, remainingAfter, dartsThrown,
--             isBust, isCheckout, input, darts: [{ m, n, points, remainingBefore, doubleTarget, doubleHit }] }]
create function dartapp.save_game(u uuid, p_game jsonb, p_turns jsonb) returns integer
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare gid uuid := (p_game->>'id')::uuid; t jsonb; d jsonb; tid uuid; i int; n int := 0;
begin
  if exists (select 1 from dartapp.games where id = gid and user_id <> u) then raise exception 'Niet toegestaan.'; end if;
  if jsonb_array_length(coalesce(p_turns, '[]')) > 3000 then raise exception 'Te veel beurten.'; end if;
  insert into dartapp.games (id, user_id, kind, mode, config, opponent_name, bot_level, started_at, finished_at, result, summary)
  values (gid, u, p_game->>'kind', p_game->>'mode', coalesce(p_game->'config', '{}'), p_game->>'opponentName',
          nullif(p_game->>'botLevel', '')::int, coalesce((p_game->>'startedAt')::timestamptz, now()),
          nullif(p_game->>'finishedAt', '')::timestamptz, nullif(p_game->>'result', ''), coalesce(p_game->'summary', '{}'))
  on conflict (id) do update set kind = excluded.kind, mode = excluded.mode, config = excluded.config,
    opponent_name = excluded.opponent_name, bot_level = excluded.bot_level, finished_at = excluded.finished_at,
    result = excluded.result, summary = excluded.summary;
  delete from dartapp.turns where game_id = gid;
  for t in select value from jsonb_array_elements(coalesce(p_turns, '[]')) loop
    insert into dartapp.turns (game_id, user_id, seq, leg_number, side, input_mode, score, remaining_before, remaining_after,
                               darts_thrown, is_bust, is_checkout, input)
    values (gid, u, (t->>'seq')::int, coalesce((t->>'legNumber')::int, 1), t->>'side', coalesce(t->>'mode', 'total'),
            coalesce((t->>'score')::int, 0), (t->>'remainingBefore')::int, (t->>'remainingAfter')::int,
            coalesce((t->>'dartsThrown')::int, 3), coalesce((t->>'isBust')::boolean, false),
            coalesce((t->>'isCheckout')::boolean, false), coalesce(t->'input', '{}'))
    returning id into tid;
    if jsonb_typeof(t->'darts') = 'array' then
      i := 0;
      for d in select value from jsonb_array_elements(t->'darts') loop
        i := i + 1;
        insert into dartapp.darts (turn_id, dart_index, multiplier, segment, points, remaining_before, double_target, double_hit)
        values (tid, i, (d->>'m')::int, (d->>'n')::int, (d->>'points')::int, (d->>'remainingBefore')::int,
                (d->>'doubleTarget')::int, (d->>'doubleHit')::boolean);
      end loop;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create function public.dartapp_sync_game(p_token text, p_game jsonb, p_turns jsonb) returns jsonb
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
begin
  return jsonb_build_object('ok', true, 'turns', dartapp.save_game(dartapp.auth_user(p_token), p_game, p_turns));
end $$;

create function public.dartapp_delete_game(p_token text, p_game_id uuid) returns void
language sql security definer set search_path = dartapp, extensions, pg_temp as
$$ delete from dartapp.games where id = p_game_id and user_id = dartapp.auth_user(p_token) $$;

-- ── Alles ophalen (statistieken, backup) ────────────────────────────────────
create function public.dartapp_get_data(p_token text) returns jsonb
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare u uuid := dartapp.auth_user(p_token); usr dartapp.users;
begin
  select * into usr from dartapp.users where id = u;
  return jsonb_build_object(
    'app', 'dartapp', 'version', 1, 'exportedAt', now(),
    'user', jsonb_build_object('username', usr.username, 'displayName', usr.display_name),
    'games', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'kind', g.kind, 'mode', g.mode, 'config', g.config,
        'opponentName', g.opponent_name, 'botLevel', g.bot_level, 'startedAt', g.started_at, 'finishedAt', g.finished_at,
        'result', g.result, 'summary', g.summary) order by g.started_at) from dartapp.games g where g.user_id = u), '[]'),
    'turns', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'gameId', t.game_id, 'seq', t.seq, 'legNumber', t.leg_number,
        'side', t.side, 'mode', t.input_mode, 'score', t.score, 'remainingBefore', t.remaining_before, 'remainingAfter', t.remaining_after,
        'dartsThrown', t.darts_thrown, 'isBust', t.is_bust, 'isCheckout', t.is_checkout, 'input', t.input,
        'darts', (select jsonb_agg(jsonb_build_object('m', d.multiplier, 'n', d.segment, 'points', d.points,
            'remainingBefore', d.remaining_before, 'doubleTarget', d.double_target, 'doubleHit', d.double_hit) order by d.dart_index)
            from dartapp.darts d where d.turn_id = t.id)) order by t.game_id, t.seq) from dartapp.turns t where t.user_id = u), '[]'));
end $$;

-- ── Terugzetten uit een backup (voegt toe / overschrijft op spel-id) ────────
create function public.dartapp_import(p_token text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare u uuid := dartapp.auth_user(p_token); g jsonb; n int := 0;
begin
  if p_payload->>'app' is distinct from 'dartapp' then raise exception 'Dit is geen dartapp-backup.'; end if;
  for g in select value from jsonb_array_elements(coalesce(p_payload->'games', '[]')) loop
    perform dartapp.save_game(u, g, coalesce((select jsonb_agg(t) from jsonb_array_elements(coalesce(p_payload->'turns', '[]')) t
                                                where t->>'gameId' = g->>'id'), '[]'));
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'games', n);
end $$;

-- ── Wissen (eigen data) ─────────────────────────────────────────────────────
create function public.dartapp_delete_my_data(p_token text, p_password text) returns jsonb
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare u uuid := dartapp.auth_user(p_token); usr dartapp.users; n int;
begin
  select * into usr from dartapp.users where id = u;
  if usr.pw_hash <> extensions.crypt(coalesce(p_password, ''), usr.pw_hash) then raise exception 'Wachtwoord klopt niet.'; end if;
  delete from dartapp.games where user_id = u;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'gamesDeleted', n);
end $$;

create function public.dartapp_delete_account(p_token text, p_password text) returns void
language plpgsql security definer set search_path = dartapp, extensions, pg_temp as $$
declare u uuid := dartapp.auth_user(p_token); usr dartapp.users;
begin
  select * into usr from dartapp.users where id = u;
  if usr.pw_hash <> extensions.crypt(coalesce(p_password, ''), usr.pw_hash) then raise exception 'Wachtwoord klopt niet.'; end if;
  delete from dartapp.users where id = u;
end $$;

-- Alleen de dartapp_*-functies zijn voor de app bereikbaar.
revoke all on function dartapp.sha(text), dartapp.auth_user(text), dartapp.new_session(uuid), dartapp.save_game(uuid, jsonb, jsonb) from public, anon, authenticated;
do $$ declare f record; begin
  for f in select oid::regprocedure as sig from pg_proc where pronamespace = 'public'::regnamespace and proname like 'dartapp\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end $$;
