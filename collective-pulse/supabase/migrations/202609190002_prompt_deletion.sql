-- Run this upgrade in an existing Collective Pulse Supabase project.
-- It updates the administrator queue function and preserves campaign data, votes, and access grants.
begin;
create or replace function pulse_private.update_queue_impl(p_operation jsonb)
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
  elsif action = 'delete' then
    question_id := p_operation->>'id';
    select ordinality::integer - 1 into position from jsonb_array_elements(c.prompts) with ordinality where value->>'id' = question_id;
    if position is null then raise sqlstate 'PT404' using message = 'Question no longer exists.'; end if;
    if c.next_id = question_id then
      c.next_id := c.prompts->((position + 1) % jsonb_array_length(c.prompts))->>'id';
    end if;
    select coalesce(jsonb_agg(value order by ordinality), '[]') into c.prompts
      from jsonb_array_elements(c.prompts) with ordinality where value->>'id' <> question_id;
    select coalesce(jsonb_agg(value order by ordinality), '[]') into c.visible
      from jsonb_array_elements(c.visible) with ordinality where value->>'id' <> question_id;
    c.next_id := pulse_private.next_prompt(c.prompts, c.next_id);
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
  update pulse_private.campaign set prompts = c.prompts, revision = c.revision, next_id = c.next_id, visible = c.visible where id = 1;
  return pulse_private.queue_document(c);
end $$;
commit;
