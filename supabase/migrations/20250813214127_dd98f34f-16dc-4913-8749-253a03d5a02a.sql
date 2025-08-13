-- Criar uma organização para o usuário de teste
INSERT INTO public.orgs (id, name, plan) 
VALUES (gen_random_uuid(), 'Organização Demo', 'starter');

-- Associar o usuário à organização criada
INSERT INTO public.org_users (user_id, org_id, role)
SELECT '14d1f229-9bf9-4585-af5d-0e8d2c23855c', orgs.id, 'admin'
FROM public.orgs 
WHERE name = 'Organização Demo';

-- Atualizar os DVRs existentes para ter org_id
UPDATE public.dvr_configs 
SET org_id = (SELECT id FROM public.orgs WHERE name = 'Organização Demo')
WHERE org_id IS NULL;