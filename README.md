# Mijn Darts

Losse, persoonlijke dart-app (React + Vite, PWA). Staat los van de HHC09 dartcompetitie:
eigen map, eigen code, en in de database een eigen schema `dartapp`.

## Starten
```
npm install
npm run dev        # lokaal, http://localhost:5173
npm test           # tests voor spellen, bot, schermen
npm run build      # productiebuild (map dist/), te deployen op Vercel
```
Eindtest tegen de echte database (maakt een tijdelijk account aan en verwijdert het weer):
```
DB_TEST=1 npx vitest run src/lib/__tests__/db.integration.test.js
```
Draait er al iets op poort 5173, dan kiest `npm run dev` zelf een andere poort, of gebruik `npx vite --port 5180`.
`.env` bevat de Supabase-URL en de publieke (publishable) sleutel.

## Online zetten (Vercel)
1. Op vercel.com: **Add New → Project** → kies deze GitHub-repository.
2. Framework: **Vite** (wordt herkend). Build: `npm run build`, output: `dist` (staat ook in `vercel.json`).
3. Bij **Environment Variables** deze twee toevoegen (dezelfde waarden als in je lokale `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. **Deploy**. Elke push naar `main` zet daarna automatisch een nieuwe versie online.

De publishable key is bedoeld om in een app te staan; de database is afgeschermd via de `dartapp_*`-functies.

## Wat zit erin
- Eigen inlog: gebruikersnaam + wachtwoord (geen Supabase-accounts)
- X01 (301/501/701, dubbel uit of straight out): solo, 1 tegen 1, tegen dartbot (niveau 1–10)
- Cricket, Around the Clock (solo / 1 tegen 1 / bot), Bob's 27 (solo)
- Invoer per totaal of per dart; per dart geeft de meeste statistieken
- Statistieken: gemiddelde, first 9, 180's, 140+/100+/60+, uitgooi-%, dubbelkaart, hoogste uitgooi,
  beste leg, busts, misser-%, "hoe vaak gooide je precies X", trend per spel
- Zonder verbinding wordt alles lokaal bewaard en later automatisch verstuurd

## Data: backup, terugzetten, verwijderen
- In de app: Instellingen → Backup maken (JSON), Terugzetten, Gegevens wissen, Account verwijderen.
- Alles in de database: `supabase/001_dartapp.sql` (al toegepast op project Dashboardpersonal).
- Alles in één keer uit de database halen: `supabase/002_uninstall.sql`
  (verwijdert schema `dartapp` en de functies `public.dartapp_*`, raakt niets anders aan).

## Veiligheid in het kort
- Tabellen in `dartapp` hebben RLS aan zonder policies en geen rechten voor `anon`/`authenticated`;
  de app kan alleen de functies `dartapp_*` aanroepen, die alleen de eigen data teruggeven.
- Wachtwoorden worden met bcrypt gehasht; sessies zijn willekeurige tokens (alleen de hash staat in de database);
  na 5 foute pogingen is inloggen 15 minuten geblokkeerd.
- De dart-engine (`src/lib/darts`) is een kopie uit de competitie-app. Wijzigingen hier raken de competitie niet en andersom.
