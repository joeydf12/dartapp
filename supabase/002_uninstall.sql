-- Verwijdert ALLE dartapp-data en -functies uit de database. Raakt niets anders aan.
-- (De extensie pgcrypto blijft staan, die kan door andere dingen gebruikt worden.)
do $$ declare f record; begin
  for f in select oid::regprocedure as sig from pg_proc where pronamespace = 'public'::regnamespace and proname like 'dartapp\_%' loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;
drop schema if exists dartapp cascade;
