// Verbinding met Supabase.
// De publishable key is bedoeld om openbaar in een app te staan: de database is
// afgeschermd (RLS, geen tabelrechten) en alleen de dartapp_*-functies zijn bereikbaar.
// Omgevingsvariabelen (VITE_…) gaan voor; zonder die variabelen (bijv. een
// Vercel-build zonder env) worden deze standaardwaarden gebruikt, zodat de app altijd werkt.
const DEFAULT_URL = 'https://ycnhujswvtyoldnqesig.supabase.co'
const DEFAULT_KEY = 'sb_publishable_0bmqQQLXlfEDmf7wL7oGIg_IwvXNGkl'

const clean = v => (typeof v === 'string' && v.trim() && !/your_|_here/i.test(v) ? v.trim() : null)

export const SUPABASE_URL = clean(import.meta.env.VITE_SUPABASE_URL) || DEFAULT_URL
export const SUPABASE_KEY = clean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || DEFAULT_KEY
