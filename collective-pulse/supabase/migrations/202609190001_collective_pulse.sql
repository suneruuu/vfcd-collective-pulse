-- This migration is self-contained and can be run in Supabase's SQL editor.
begin;
create schema if not exists pulse_private;
revoke all on schema pulse_private from public;

create table pulse_private.campaign (
  id integer primary key check (id = 1),
  start_date date not null,
  days integer not null check (days between 1 and 31),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  open_hour integer not null default 9,
  close_hour integer not null default 18,
  revision bigint not null default 0,
  prompts jsonb not null default '[]',
  processed_slots integer not null default 0,
  next_id text,
  visible jsonb not null default '[]',
  last_vote_id bigint not null default 0,
  check (open_hour >= 0 and close_hour <= 24 and close_hour > open_hour)
);
create table pulse_private.batches (
  request_id uuid primary key,
  choices integer[] not null
);
create table pulse_private.votes (
  id bigint primary key,
  request_id uuid not null references pulse_private.batches(request_id),
  timestamp_ms bigint not null,
  choice integer not null check (choice in (1, -1))
);
create index pulse_votes_request on pulse_private.votes(request_id);
create table pulse_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table pulse_private.campaign enable row level security;
alter table pulse_private.batches enable row level security;
alter table pulse_private.votes enable row level security;
alter table pulse_private.admins enable row level security;

insert into pulse_private.campaign(id, start_date, days, prompts, next_id)
values (1, '2026-09-21', 7, '[
  {"id":"default-13","text":"Do we still need festivals?","hidden":false},
  {"id":"default-14","text":"Can a festival change how you see your city?","hidden":false},
  {"id":"default-15","text":"Should a festival surprise you?","hidden":false},
  {"id":"default-16","text":"Should a festival make you uncomfortable?","hidden":false},
  {"id":"default-17","text":"Can strangers become a temporary community?","hidden":false},
  {"id":"default-18","text":"Can creativity bring people together?","hidden":false},
  {"id":"default-19","text":"Does a festival need a stage?","hidden":false},
  {"id":"default-20","text":"Does a festival need an audience?","hidden":false},
  {"id":"default-21","text":"Can a festival exist without performances?","hidden":false},
  {"id":"default-22","text":"Can a festival happen anywhere?","hidden":false},
  {"id":"default-23","text":"Can the whole city become a festival?","hidden":false},
  {"id":"default-24","text":"Does a festival end when the programme ends?","hidden":false},
  {"id":"default-25","text":"Are audiences part of the festival?","hidden":false},
  {"id":"default-26","text":"Should audiences help decide what happens next?","hidden":false},
  {"id":"default-27","text":"Should audiences become co-producers rather than spectators?","hidden":false},
  {"id":"default-28","text":"Can participation be more important than programming?","hidden":false},
  {"id":"default-29","text":"Should a festival give up some control to its audience?","hidden":false},
  {"id":"default-30","text":"Would you help shape the next festival?","hidden":false},
  {"id":"default-31","text":"Does a festival belong to the city where it happens?","hidden":false},
  {"id":"default-32","text":"Should a festival respond to the problems of its city?","hidden":false},
  {"id":"default-33","text":"Should festivals happen outside cultural venues?","hidden":false},
  {"id":"default-34","text":"Can a festival change how public space is used?","hidden":false},
  {"id":"default-35","text":"Should local communities have more influence than international guests?","hidden":false},
  {"id":"default-36","text":"Could festivals help shape Vietnam''s cultural future?","hidden":false},
  {"id":"default-37","text":"Can you be fully present at a festival through a phone?","hidden":false},
  {"id":"default-38","text":"Does technology bring audiences closer together?","hidden":false},
  {"id":"default-39","text":"Should AI have a role in shaping a festival?","hidden":false},
  {"id":"default-40","text":"Could an algorithm curate a festival you would trust?","hidden":false},
  {"id":"default-41","text":"Should a festival know what its audience is feeling in real time?","hidden":false},
  {"id":"default-42","text":"Would you change your answer after seeing everyone else''s answers?","hidden":false},
  {"id":"default-43","text":"Does a festival have to attract large audiences to be successful?","hidden":false},
  {"id":"default-44","text":"Does a festival have to make money to survive?","hidden":false},
  {"id":"default-45","text":"Can a festival be valuable even if it fails?","hidden":false},
  {"id":"default-46","text":"Should festivals spend resources on experiments that might not work?","hidden":false},
  {"id":"default-47","text":"Is cultural value more important than economic value?","hidden":false},
  {"id":"default-48","text":"Should a festival produce something that lasts?","hidden":false},
  {"id":"default-49","text":"Should institutions control festivals?","hidden":false},
  {"id":"default-50","text":"Should artists have more power than sponsors?","hidden":false},
  {"id":"default-51","text":"Should communities have more power than organisers?","hidden":false},
  {"id":"default-52","text":"Can a festival remain independent if it depends on sponsorship?","hidden":false},
  {"id":"default-53","text":"Should everyone have equal access to a festival?","hidden":false},
  {"id":"default-54","text":"Can a festival genuinely belong to everyone?","hidden":false},
  {"id":"default-55","text":"Can a festival be alive?","hidden":false},
  {"id":"default-56","text":"Can a festival learn from its audience?","hidden":false},
  {"id":"default-57","text":"Should a festival change while it is happening?","hidden":false},
  {"id":"default-58","text":"Should today''s audience change tomorrow''s programme?","hidden":false},
  {"id":"default-59","text":"Can disagreement make a festival stronger?","hidden":false},
  {"id":"default-60","text":"Is this festival different now because you are here?","hidden":false},
  {"id":"default-61","text":"Should the festival of the future look different from today''s festival?","hidden":false},
  {"id":"default-62","text":"Could a festival exist without a fixed programme?","hidden":false},
  {"id":"default-63","text":"Could a festival continue all year?","hidden":false},
  {"id":"default-64","text":"Could a festival be a laboratory rather than an event?","hidden":false},
  {"id":"default-65","text":"Could festivals help imagine different futures for society?","hidden":false},
  {"id":"default-66","text":"Can festivals change the future?","hidden":false},
  {"id":"default-67","text":"Did this festival change your mind about something?","hidden":false},
  {"id":"default-68","text":"Did you feel part of this festival?","hidden":false},
  {"id":"default-69","text":"Did you encounter someone you would not normally meet?","hidden":false},
  {"id":"default-70","text":"Would you like more festivals like this in Vietnam?","hidden":false},
  {"id":"default-71","text":"Should this festival return?","hidden":false},
  {"id":"default-72","text":"Should the next festival be shaped by what we answered here?","hidden":false}
]', 'default-13');

create function pulse_private.next_prompt(p_prompts jsonb, p_start text)
returns text language plpgsql immutable set search_path = '' as $$
declare n integer := jsonb_array_length(p_prompts); first_index integer := 0; i integer; item jsonb;
begin
  if n = 0 then return null; end if;
  for i in 0..n-1 loop
    if p_prompts->i->>'id' = p_start then first_index := i; exit; end if;
  end loop;
  for i in 0..n-1 loop
    item := p_prompts->((first_index + i) % n);
    if not (item->>'hidden')::boolean then return item->>'id'; end if;
  end loop;
  return null;
end $$;

-- All writers take this row lock, so IDs become visible in commit order.
-- This makes incremental reads safe even with concurrent vote submissions.
create function pulse_private.refresh_campaign()
returns pulse_private.campaign language plpgsql security definer set search_path = '' as $$
declare c pulse_private.campaign; local_now timestamp; display_day integer;
  slots_per_day integer; current_slot integer; target integer; slot_day integer;
  slot_number integer; prompt_id text; prompt_index integer; shown_at bigint; initial_slot integer;
begin
  select * into strict c from pulse_private.campaign where id = 1 for update;
  initial_slot := c.processed_slots;
  local_now := clock_timestamp() at time zone c.timezone;
  slots_per_day := (c.close_hour - c.open_hour) * 12 - 1;
  display_day := greatest(0, least(c.days - 1, local_now::date - c.start_date));
  current_slot := greatest(0, least(slots_per_day,
    floor(extract(epoch from (local_now - (c.start_date + display_day + make_time(c.open_hour, 0, 0)))) / 300)::integer));
  if local_now::date < c.start_date then target := 0;
  elsif local_now::date >= c.start_date + c.days then target := c.days * slots_per_day;
  else target := display_day * slots_per_day + current_slot;
  end if;
  while c.processed_slots < target loop
    slot_day := c.processed_slots / slots_per_day;
    slot_number := c.processed_slots % slots_per_day + 1;
    prompt_id := pulse_private.next_prompt(c.prompts, c.next_id);
    if prompt_id is not null then
      shown_at := floor(extract(epoch from (
        (c.start_date + slot_day + make_time(c.open_hour, 0, 0) + slot_number * interval '5 minutes')
        at time zone c.timezone)) * 1000)::bigint;
      c.visible := c.visible || jsonb_build_array(jsonb_build_object('id', prompt_id, 'shownAt', shown_at));
      if jsonb_array_length(c.visible) > 5 then c.visible := c.visible - 0; end if;
      select ordinality::integer - 1 into prompt_index
        from jsonb_array_elements(c.prompts) with ordinality where value->>'id' = prompt_id;
      c.next_id := c.prompts->((prompt_index + 1) % jsonb_array_length(c.prompts))->>'id';
    end if;
    c.processed_slots := c.processed_slots + 1;
  end loop;
  if c.processed_slots <> initial_slot then
    update pulse_private.campaign set processed_slots = c.processed_slots, next_id = c.next_id, visible = c.visible where id = 1;
  end if;
  return c;
end $$;

create function pulse_private.queue_document(c pulse_private.campaign)
returns jsonb language plpgsql stable set search_path = '' as $$
declare local_now timestamp := current_timestamp at time zone c.timezone;
  display_day integer := greatest(0, least(c.days - 1, local_now::date - c.start_date));
  recent jsonb; current_id text; active boolean;
begin
  select coalesce(jsonb_agg(item order by (item->>'shownAt')::bigint), '[]') into recent
  from jsonb_array_elements(c.visible) item
  where (to_timestamp((item->>'shownAt')::numeric / 1000) at time zone c.timezone)::date = c.start_date + display_day
    and exists (select 1 from jsonb_array_elements(c.prompts) prompt where prompt->>'id' = item->>'id' and not (prompt->>'hidden')::boolean);
  current_id := recent->-1->>'id';
  active := local_now::date >= c.start_date and local_now::date < c.start_date + c.days
    and extract(hour from local_now) >= c.open_hour and extract(hour from local_now) < c.close_hour;
  return jsonb_build_object('version', 1, 'revision', c.revision, 'prompts', c.prompts,
    'installation', jsonb_build_object('online', true, 'cloud', true, 'revision', c.revision,
      'currentId', current_id, 'nextId', pulse_private.next_prompt(c.prompts, c.next_id),
      'active', active, 'campaignStartDate', c.start_date),
    'sharedPrompts', jsonb_build_object('dayIndex', display_day, 'currentId', current_id, 'visible', recent));
end $$;

create function pulse_private.read_impl(p_after bigint, p_include_votes boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c pulse_private.campaign; page jsonb := '[]'; next_cursor bigint := p_after;
begin
  if p_after is null or p_after < 0 or p_include_votes is null then raise sqlstate 'PT400' using message = 'Invalid vote cursor.'; end if;
  c := pulse_private.refresh_campaign();
  if p_include_votes then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'timestamp', timestamp_ms, 'choice', choice) order by id), '[]'), coalesce(max(id), p_after)
      into page, next_cursor from (select * from pulse_private.votes where id > p_after order by id limit 1000) records;
  end if;
  return jsonb_build_object('serverNow', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'campaign', jsonb_build_object('startMs', floor(extract(epoch from (c.start_date::timestamp at time zone c.timezone)) * 1000)::bigint,
      'startDate', c.start_date, 'days', c.days, 'openHour', c.open_hour, 'closeHour', c.close_hour),
    'votes', page, 'cursor', next_cursor, 'hasMore', p_include_votes and next_cursor < c.last_vote_id,
    'queue', pulse_private.queue_document(c));
end $$;

create function pulse_private.submit_impl(p_request_id uuid, p_choices integer[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c pulse_private.campaign; stored integer[]; local_now timestamp; stamp bigint; receipt jsonb;
begin
  if p_request_id is null or p_choices is null or cardinality(p_choices) < 1 or cardinality(p_choices) > 256
    or array_ndims(p_choices) <> 1 or exists (select 1 from unnest(p_choices) choice where choice is null or choice not in (1, -1))
    then raise sqlstate 'PT400' using message = 'Choose YES or NO (maximum 256 responses per sample).'; end if;
  select * into strict c from pulse_private.campaign where id = 1 for update;
  select choices into stored from pulse_private.batches where request_id = p_request_id;
  if found then
    if stored <> p_choices then raise sqlstate 'PT409' using message = 'Request ID already belongs to another sample.'; end if;
  else
    local_now := clock_timestamp() at time zone c.timezone;
    if local_now::date < c.start_date or local_now::date >= c.start_date + c.days
      or extract(hour from local_now) < c.open_hour or extract(hour from local_now) >= c.close_hour
      then raise sqlstate 'PT400' using message = 'Voting is currently closed.'; end if;
    stamp := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
    insert into pulse_private.batches values (p_request_id, p_choices);
    insert into pulse_private.votes(id, request_id, timestamp_ms, choice)
      select c.last_vote_id + ordinality, p_request_id, stamp, choice from unnest(p_choices) with ordinality as choices(choice, ordinality);
    update pulse_private.campaign set last_vote_id = last_vote_id + cardinality(p_choices) where id = 1;
  end if;
  select jsonb_agg(jsonb_build_object('id', id, 'timestamp', timestamp_ms, 'choice', choice) order by id)
    into receipt from pulse_private.votes where request_id = p_request_id;
  return jsonb_build_object('votes', receipt);
end $$;

create function pulse_private.is_admin_impl()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from pulse_private.admins where user_id = auth.uid());
$$;

create function pulse_private.update_queue_impl(p_operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c pulse_private.campaign; action text; question jsonb; ordered jsonb;
  position integer; question_id text; clean_text text; ids jsonb; live jsonb;
begin
  if not pulse_private.is_admin_impl() then raise sqlstate 'PT403' using message = 'Administrator access required.'; end if;
  c := pulse_private.refresh_campaign();
  live := pulse_private.queue_document(c)->'installation';
  if p_operation is null or jsonb_typeof(p_operation->'revision') is distinct from 'number'
    or p_operation->>'revision' <> c.revision::text then raise sqlstate 'PT409' using message = 'The queue changed on another device. Review the latest queue and try again.'; end if;
  action := p_operation->>'operation';
  if action in ('add', 'edit') then
    if jsonb_typeof(p_operation->'text') is distinct from 'string' then raise sqlstate 'PT400' using message = 'Enter a question between 1 and 240 characters.'; end if;
    clean_text := regexp_replace(p_operation->>'text', '^\s+|\s+$', '', 'g');
    if length(clean_text) < 1 or length(clean_text) > 240 then raise sqlstate 'PT400' using message = 'Enter a question between 1 and 240 characters.'; end if;
  end if;
  if action = 'add' then
    if jsonb_array_length(c.prompts) >= 500 then raise sqlstate 'PT400' using message = 'The queue is full (500 questions).'; end if;
    question := jsonb_build_object('id', gen_random_uuid()::text, 'text', clean_text, 'hidden', false);
    if p_operation->>'position' = 'bottom' then c.prompts := c.prompts || jsonb_build_array(question);
    elsif p_operation->>'position' = 'next' then
      live := pulse_private.queue_document(c)->'installation';
      select ordinality::integer into position from jsonb_array_elements(c.prompts) with ordinality where value->>'id' = live->>'currentId';
      if position is null then
        select ordinality::integer - 1 into position from jsonb_array_elements(c.prompts) with ordinality where value->>'id' = live->>'nextId';
        position := coalesce(position, 0);
      end if;
      select coalesce(jsonb_agg(value order by sort), '[]') into ordered from (
        select value, ordinality * 2 as sort from jsonb_array_elements(c.prompts) with ordinality
        union all select question, position * 2 + 1
      ) items;
      c.prompts := ordered;
      c.next_id := question->>'id';
    else raise sqlstate 'PT400' using message = 'Choose next or bottom.'; end if;
  elsif action in ('edit', 'visibility') then
    question_id := p_operation->>'id';
    if not exists (select 1 from jsonb_array_elements(c.prompts) where value->>'id' = question_id) then raise sqlstate 'PT404' using message = 'Question no longer exists.'; end if;
    if action = 'visibility' and jsonb_typeof(p_operation->'hidden') is distinct from 'boolean' then raise sqlstate 'PT400' using message = 'Invalid visibility.'; end if;
    select jsonb_agg(case when value->>'id' = question_id then value ||
      case when action = 'edit' then jsonb_build_object('text', clean_text) else jsonb_build_object('hidden', (p_operation->>'hidden')::boolean) end
      else value end order by ordinality) into c.prompts from jsonb_array_elements(c.prompts) with ordinality;
  elsif action = 'reorder' then
    ids := p_operation->'ids';
    if jsonb_typeof(ids) is distinct from 'array' then raise sqlstate 'PT400' using message = 'Reorder must include every question exactly once.'; end if;
    if jsonb_array_length(ids) <> jsonb_array_length(c.prompts)
      or (select count(distinct value) from jsonb_array_elements(ids)) <> jsonb_array_length(ids)
      or exists (select 1 from jsonb_array_elements(ids) item where jsonb_typeof(item) <> 'string' or not exists (
        select 1 from jsonb_array_elements(c.prompts) prompt where prompt->>'id' = item #>> '{}'))
      then raise sqlstate 'PT400' using message = 'Reorder must include every question exactly once.'; end if;
    select coalesce(jsonb_agg(prompt order by ids.ordinality), '[]') into c.prompts
      from jsonb_array_elements_text(ids) with ordinality ids
      join jsonb_array_elements(c.prompts) prompt on prompt->>'id' = ids.value;
    select ordinality::integer into position from jsonb_array_elements(c.prompts) with ordinality where value->>'id' = live->>'currentId';
    if position is not null then c.next_id := c.prompts->(position % jsonb_array_length(c.prompts))->>'id'; end if;
  else raise sqlstate 'PT400' using message = 'Unknown queue operation.'; end if;
  c.revision := c.revision + 1;
  update pulse_private.campaign set prompts = c.prompts, revision = c.revision, next_id = c.next_id where id = 1;
  return pulse_private.queue_document(c);
end $$;

-- Invoker wrappers expose only these capabilities through the Data API.
-- Definer implementations remain in a schema that is NOT exposed by PostgREST.
create function public.pulse_read(p_after bigint default 0, p_include_votes boolean default true)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select pulse_private.read_impl(p_after, p_include_votes); $$;
create function public.pulse_submit(p_request_id uuid, p_choices integer[])
returns jsonb language sql volatile security invoker set search_path = '' as $$ select pulse_private.submit_impl(p_request_id, p_choices); $$;
create function public.pulse_is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$ select pulse_private.is_admin_impl(); $$;
create function public.pulse_update_queue(p_operation jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select pulse_private.update_queue_impl(p_operation); $$;

revoke all on all tables in schema pulse_private from public, anon, authenticated;
revoke all on all functions in schema pulse_private from public, anon, authenticated;
revoke all on function public.pulse_read(bigint, boolean), public.pulse_submit(uuid, integer[]), public.pulse_is_admin(), public.pulse_update_queue(jsonb) from public, anon, authenticated;
grant usage on schema pulse_private to anon, authenticated;
grant execute on function public.pulse_read(bigint, boolean), public.pulse_submit(uuid, integer[]), pulse_private.read_impl(bigint, boolean), pulse_private.submit_impl(uuid, integer[]) to anon, authenticated;
grant execute on function public.pulse_is_admin(), public.pulse_update_queue(jsonb), pulse_private.is_admin_impl(), pulse_private.update_queue_impl(jsonb) to authenticated;
commit;
