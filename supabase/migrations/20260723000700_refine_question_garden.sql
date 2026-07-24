alter table public.question_garden_questions
  disable trigger protect_question_garden_question;

update public.question_garden_questions
set
  active = false,
  archived_at = coalesce(archived_at, now())
where source_type = 'curated'
  and id in (
    '90000000-0000-4000-8000-000000000003',
    '90000000-0000-4000-8000-000000000004',
    '90000000-0000-4000-8000-000000000013',
    '90000000-0000-4000-8000-000000000014',
    '90000000-0000-4000-8000-000000000017'
  );

update public.question_garden_questions as question
set
  active = true,
  archived_at = null,
  sort_order = desired.sort_order
from (
  values
    ('90000000-0000-4000-8000-000000000001'::uuid, 1),
    ('90000000-0000-4000-8000-000000000002'::uuid, 2),
    ('90000000-0000-4000-8000-000000000005'::uuid, 3),
    ('90000000-0000-4000-8000-000000000006'::uuid, 4),
    ('90000000-0000-4000-8000-000000000007'::uuid, 5),
    ('90000000-0000-4000-8000-000000000008'::uuid, 6),
    ('90000000-0000-4000-8000-000000000009'::uuid, 7),
    ('90000000-0000-4000-8000-000000000010'::uuid, 8),
    ('90000000-0000-4000-8000-000000000011'::uuid, 9),
    ('90000000-0000-4000-8000-000000000012'::uuid, 10),
    ('90000000-0000-4000-8000-000000000015'::uuid, 11),
    ('90000000-0000-4000-8000-000000000016'::uuid, 12),
    ('90000000-0000-4000-8000-000000000018'::uuid, 13),
    ('90000000-0000-4000-8000-000000000019'::uuid, 14),
    ('90000000-0000-4000-8000-000000000020'::uuid, 15),
    ('90000000-0000-4000-8000-000000000021'::uuid, 16),
    ('90000000-0000-4000-8000-000000000022'::uuid, 17),
    ('90000000-0000-4000-8000-000000000023'::uuid, 18),
    ('90000000-0000-4000-8000-000000000024'::uuid, 19),
    ('90000000-0000-4000-8000-000000000025'::uuid, 20)
) as desired(id, sort_order)
where question.id = desired.id
  and question.source_type = 'curated';

alter table public.question_garden_questions
  enable trigger protect_question_garden_question;
