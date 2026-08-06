create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa' check (char_length(title) between 1 and 120),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  action jsonb,
  action_status text check (action_status is null or action_status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "Users manage own AI conversations" on public.ai_conversations for all
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users manage own AI messages" on public.ai_messages for all
using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = conversation_id and conversation.user_id = (select auth.uid())
  )
);

create index if not exists ai_conversations_user_updated_idx on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages (conversation_id, created_at);

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
