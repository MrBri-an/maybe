create or replace function public.protect_journey_completion_and_timestamps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  field_name text;
  old_value jsonb;
  related_field text;
begin
  for field_name, old_value in
    select key, value
    from jsonb_each(old_row)
    where key like '%\_completed_at' escape '\'
       or key like '%\_skipped_at' escape '\'
  loop
    if old_value <> 'null'::jsonb
       and new_row -> field_name is distinct from old_value then
      raise exception using
        errcode = '23514',
        message = format('journey progress field %s is monotonic', field_name);
    end if;
  end loop;

  for field_name, old_value in
    select key, value
    from jsonb_each(old_row)
    where key like '%\_best_score' escape '\'
  loop
    if jsonb_typeof(old_value) = 'number'
       and jsonb_typeof(new_row -> field_name) = 'number'
       and (new_row ->> field_name)::numeric < (old_value #>> '{}')::numeric then
      new_row := jsonb_set(new_row, array[field_name], old_value);
    end if;
  end loop;

  for field_name, old_value in
    select key, value
    from jsonb_each(old_row)
    where key like '%\_attempt_state' escape '\'
  loop
    related_field := regexp_replace(field_name, '_state$', '_updated_at');
    if new_row -> field_name is distinct from old_value
       and old_row ? related_field then
      new_row := jsonb_set(new_row, array[related_field], to_jsonb(now()));
    end if;
  end loop;

  new_row := jsonb_set(new_row, '{user_id}', old_row -> 'user_id');
  new_row := jsonb_set(new_row, '{created_at}', old_row -> 'created_at');
  new_row := jsonb_set(new_row, '{updated_at}', to_jsonb(now()));

  if new_row -> 'storybook_page' is distinct from old_row -> 'storybook_page' then
    new_row := jsonb_set(new_row, '{storybook_page_updated_at}', to_jsonb(now()));
  end if;

  new := jsonb_populate_record(new, new_row);
  return new;
end;
$$;
