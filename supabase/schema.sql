-- בונה מערכות – טבלאות לאתר
-- להריץ פעם אחת ב-Supabase: SQL Editor > New query > להדביק > Run

create table if not exists public.leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null default 'טופס',        -- טופס / צ'אט
  name text not null,
  contact text not null,
  need text not null,
  session text,
  handled boolean not null default false
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session text not null,
  role text not null check (role in ('user','assistant')),
  content text not null
);
create index if not exists chat_messages_session_idx on public.chat_messages (session, created_at);

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day date not null default (now() at time zone 'Asia/Jerusalem')::date,
  visitor text not null,
  page text,
  ref text
);
create unique index if not exists visits_unique_day on public.visits (day, visitor);

-- נעילה: אף אחד מהדף לא קורא או כותב ישירות. רק ה-Edge Function (עם מפתח השרת) ניגשת.
alter table public.leads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.visits enable row level security;

-- סיכום מבקרים לפי יום (לצפייה ב-Supabase)
create or replace view public.visits_per_day with (security_invoker = true) as
  select day, count(*) as visitors from public.visits group by day order by day desc;
