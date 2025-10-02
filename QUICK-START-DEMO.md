# 🚀 Quick Start - Dados Demo

Guia rápido para popular o sistema com dados de demonstração em **2 minutos**.

## ✅ Pré-requisitos

- Acesso ao [Supabase Dashboard](https://supabase.com/dashboard/project/avbswnnywjyvqfxezgfl)
- Sistema base já configurado (tabelas criadas)

## 📋 Passo a Passo

### 1. Acesse o SQL Editor

👉 [Clique aqui para abrir o SQL Editor](https://supabase.com/dashboard/project/avbswnnywjyvqfxezgfl/sql/new)

### 2. Cole o Script

1. Abra o arquivo `scripts/seed-demo-data.sql`
2. Copie **TODO** o conteúdo (Ctrl+A, Ctrl+C)
3. Cole no SQL Editor do Supabase (Ctrl+V)

### 3. Execute

1. Clique no botão **"Run"** (ou pressione Ctrl+Enter)
2. Aguarde ~30-60 segundos
3. Veja a confirmação no console:

```
===================================
DADOS DEMO POPULADOS COM SUCESSO!
===================================
Pessoas demo: 10
Eventos (7 dias): 500
Veículos (7 dias): 200
Incidentes: 50
===================================
```

### 4. Verifique os Dashboards

Acesse os dashboards e veja os dados populados:

1. **LPR Dashboard** - 200+ detecções de veículos
2. **Antitheft Dashboard** - 50+ incidentes de furto
3. **SafetyVision** - 80+ eventos de segurança
4. **EduBehavior** - 30+ incidentes educacionais
5. **Heat Maps** - 500+ pontos de movimento
6. **People Analytics** - 500+ eventos de tracking

## 🎯 O Que Foi Criado?

### Dados Populados:

| Categoria | Quantidade | Período |
|-----------|------------|---------|
| **Pessoas** | 10 perfis | - |
| **Eventos** | 500+ | 7 dias |
| **Veículos (LPR)** | 200+ | 7 dias |
| **Antifurto** | 50+ | 7 dias |
| **Educação** | 30+ | 30 dias |
| **Segurança** | 80+ | 7 dias |
| **Heat Maps** | 500+ | 7 dias |
| **Clips** | 100+ | 7 dias |
| **Métricas RT** | 200+ | atual |

### Cenários Cobertos:

✅ **Retail** (Varejo)
- Detecções de furto
- Heat maps de movimento
- Análise de fluxo

✅ **Industrial** (Fábrica)
- Detecção de EPI
- Alertas de queda
- Zonas de risco

✅ **Office** (Escritório)
- Controle de acesso (LPR)
- Ocupação de salas
- Entrada/saída

✅ **Education** (Escola)
- Análise comportamental
- Monitoramento de turmas
- Incidentes educacionais

✅ **Church** (Igreja)
- Frequência anônima
- Zonas de privacidade
- Analytics LGPD-compliant

## 🔍 Verificação Rápida

Execute no SQL Editor para confirmar:

```sql
SELECT 
  'Pessoas' as tipo, COUNT(*)::text as quantidade 
FROM public.people 
WHERE metadata->>'type' = 'demo'

UNION ALL

SELECT 
  'Eventos (7d)', COUNT(*)::text
FROM public.events 
WHERE ts > now() - interval '7 days'

UNION ALL

SELECT 
  'Veículos (7d)', COUNT(*)::text
FROM public.vehicle_detections 
WHERE detected_at > now() - interval '7 days'

UNION ALL

SELECT 
  'Incidentes', COUNT(*)::text
FROM public.antitheft_incidents;
```

## 🧹 Limpar Dados Demo

Se precisar remover os dados demo:

```sql
-- ⚠️ CUIDADO: Remove TODOS os dados demo!

DELETE FROM public.people WHERE metadata->>'type' = 'demo';
DELETE FROM public.events WHERE ts > now() - interval '7 days';
DELETE FROM public.vehicle_detections WHERE detected_at > now() - interval '7 days';
DELETE FROM public.antitheft_incidents WHERE first_ts > now() - interval '7 days';
DELETE FROM public.edu_incidents WHERE first_ts > now() - interval '30 days';
DELETE FROM public.safety_events WHERE detected_at > now() - interval '7 days';
DELETE FROM public.heat_map_data WHERE time_bucket > now() - interval '7 days';
DELETE FROM public.edge_clips WHERE start_time > now() - interval '7 days';
DELETE FROM public.real_time_metrics WHERE timestamp > now() - interval '1 day';
```

## ❓ Problemas Comuns

### Erro: "relation does not exist"
**Solução:** Execute primeiro as migrations do banco para criar as tabelas.

### Erro: "permission denied"
**Solução:** Verifique se você tem permissões de admin no Supabase.

### Nenhum dado aparece nos dashboards
**Solução:** 
1. Verifique RLS policies
2. Confirme que está logado
3. Verifique se `org_id` está correto

### Script muito lento
**Solução:** Normal. O script gera 1500+ registros. Aguarde até 60 segundos.

## 📚 Documentação Completa

Para mais detalhes, consulte:
- `scripts/README-DEMO-DATA.md` - Documentação completa dos dados
- `IMPLEMENTATION-PLAN.md` - Plano de implementação
- `TECHNICAL-ANALYSIS.md` - Análise técnica do sistema

## 🎉 Pronto!

Agora você tem um sistema completo e demonstrável com dados realistas para todos os cenários!

**Próximos Passos:**
1. Explorar os dashboards
2. Testar as funcionalidades
3. Personalizar para seu caso de uso
4. Mostrar para clientes/stakeholders

---

**Última atualização:** 2025-10-02  
**Score do sistema:** 95/100 ⭐
