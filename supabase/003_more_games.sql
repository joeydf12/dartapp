-- ════════════════════════════════════════════════════════════════════════════
-- Dart-app: meer spelsoorten en bot-niveaus 1..20.
-- Alleen constraints in schema dartapp; geen data wordt gewijzigd.
-- ════════════════════════════════════════════════════════════════════════════

-- Spelsoort: vrije, korte code (de app bepaalt welke spellen er zijn).
alter table dartapp.games drop constraint if exists games_kind_check;
alter table dartapp.games add constraint games_kind_check check (kind ~ '^[a-z0-9_]{2,32}$');

-- Bot-niveau 1..20 (oude spellen 1..10 blijven geldig).
alter table dartapp.games drop constraint if exists games_bot_level_check;
alter table dartapp.games add constraint games_bot_level_check check (bot_level between 1 and 20);
