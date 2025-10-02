# Dados de Demonstração - Visão de Águia

Este documento descreve os dados demo populados no sistema para facilitar demonstrações e testes.

## 📊 Visão Geral

O script `seed-demo-data.sql` popula o banco de dados com dados realistas simulando:
- **30 dias** de histórico
- **10 pessoas** demo
- **500+ eventos** de detecção
- **200+ detecções de veículos** (LPR)
- **50+ incidentes de antifurto**
- **30+ incidentes educacionais**
- **80+ eventos de segurança do trabalho**
- **100+ clips** exportados
- **500+ pontos** de heat map
- **200+ métricas** em tempo real

## 🚀 Como Usar

### Método 1: Via Supabase Dashboard

1. Acesse o [SQL Editor do Supabase](https://supabase.com/dashboard/project/avbswnnywjyvqfxezgfl/sql/new)
2. Cole o conteúdo de `seed-demo-data.sql`
3. Execute o script
4. Aguarde a confirmação no console

### Método 2: Via CLI (Produção)

```bash
# Conectar ao banco
psql postgresql://[CONNECTION_STRING]

# Executar script
\i scripts/seed-demo-data.sql
```

## 📋 Dados Populados

### 1. Pessoas Demo (10 registros)

| Nome | Cenário | Role |
|------|---------|------|
| João Silva | Retail | Customer |
| Maria Santos | Office | Employee |
| Pedro Costa | Industrial | Worker |
| Ana Oliveira | Retail | Customer |
| Carlos Ferreira | Office | Manager |
| Julia Rodrigues | Church | Member |
| Roberto Almeida | Industrial | Supervisor |
| Fernanda Lima | Retail | Employee |
| Marcos Pereira | Office | Security |
| Patricia Souza | Church | Visitor |

### 2. Eventos (500 registros - 7 dias)

- **Câmeras:** camera_1 a camera_5
- **Tipos:** face, movement, reid, tracking
- **Face Similarity:** 75-99%
- **ReID Similarity:** 70-99%
- **Frames confirmados:** 3-15 por evento
- **Movimento:** 10-100 pixels

### 3. Detecções de Veículos (200 registros)

**Placas demo:**
- Formato antigo: ABC1234, DEF5678, GHI9012, etc.
- Formato Mercosul: ABC1D23, DEF2E45, GHI3F67, etc.

**Tipos de veículos:**
- car, truck, motorcycle, van, suv

**Cores:**
- white, black, silver, blue, red, gray

**Confidence:** 80-99%

### 4. Incidentes Antifurto (50 registros)

**Câmeras:** camera_loja_1, camera_loja_2, camera_loja_3

**Tipos de incidente:**
- concealment_dwell (permanência em área de ocultação)
- shelf_out_movement (movimento suspeito em prateleiras)
- exit_grace_violation (saída sem pagamento)
- high_value_dwell (permanência em área de alto valor)

**Severidades:** low, medium, high

**Status:** pending_review, confirmed, false_positive

### 5. Incidentes Educacionais (30 registros)

**Classes:**
- Turma A - 3º Ano (Sala 101)
- Turma B - 5º Ano (Sala 203)
- Turma C - 7º Ano (Sala 305)

**Tipos de comportamento monitorado:**
- Estudante distraído durante aula
- Comportamento inadequado identificado
- Necessita atenção especial
- Padrão de comportamento normal

### 6. Eventos de Segurança (80 registros)

**Sites:**
- Fábrica Norte
- Armazém Sul
- Depósito Central

**Tipos de evento:**
- no_helmet (sem capacete)
- no_vest (sem colete)
- fall_detected (queda detectada)
- restricted_area (área restrita)

**Severidades:** low, medium, high, critical

### 7. Heat Maps (500 pontos)

**Câmeras:** camera_retail_1 a camera_retail_4

**Métricas:**
- Intensidade de calor: 0-100
- Contagem de movimento: 0-50 por zona
- Tempo médio de permanência: 10-130 segundos

### 8. Clips Exportados (100 registros)

**Tipos:**
- antitheft
- safety
- general
- security

**Características:**
- Duração: 30-60 segundos
- Tamanho: 2.5-10 MB
- Privacy aplicada: 70% dos clips
- Face blur: 50% dos clips
- Plate blur: 50% dos clips
- Retenção: 30-90 dias

### 9. Métricas em Tempo Real (200 registros)

**Tipos:**
- people_count (contagem de pessoas)
- dwell_time (tempo de permanência)
- movement_speed (velocidade de movimento)
- zone_occupancy (ocupação de zona)

**Confidence:** 80-99%

## 🎯 Cenários de Demonstração

### Cenário 1: Retail (Varejo)

**Dashboards relevantes:**
- Antitheft Dashboard
- Heat Map Analytics
- People Counting

**Dados disponíveis:**
- 50 incidentes de antifurto
- 500 pontos de heat map
- Eventos de movimento e tracking

### Cenário 2: Industrial (Fábrica)

**Dashboards relevantes:**
- SafetyVision Dashboard
- PPE Compliance
- Fall Detection

**Dados disponíveis:**
- 80 eventos de segurança
- Detecções de EPI
- Alertas de queda

### Cenário 3: Office (Escritório)

**Dashboards relevantes:**
- People Analytics
- Access Control (LPR)
- Occupancy Metrics

**Dados disponíveis:**
- 200 detecções de veículos
- Métricas de ocupação
- Eventos de entrada/saída

### Cenário 4: Education (Escola)

**Dashboards relevantes:**
- EduBehavior Dashboard
- Student Analytics
- Classroom Monitoring

**Dados disponíveis:**
- 30 incidentes educacionais
- 3 turmas configuradas
- Análise comportamental

### Cenário 5: Church (Igreja)

**Dashboards relevantes:**
- Vision4Church Dashboard
- Privacy Controls
- Attendance Analytics

**Dados disponíveis:**
- Eventos com privacidade total
- Análise de frequência
- Zonas sagradas configuradas

## 🔄 Limpeza de Dados

Para remover os dados demo:

```sql
-- CUIDADO: Isso removerá TODOS os dados demo!

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

## 📈 Próximos Passos

1. **Imagens realistas:** Adicionar imagens fake de pessoas e veículos
2. **Vídeos demo:** Criar clips de exemplo para cada cenário
3. **Mais variabilidade:** Adicionar mais padrões de comportamento
4. **Dados temporais:** Simular padrões por hora do dia e dia da semana

## 🎨 Personalização

Para adaptar os dados ao seu cenário:

1. **Ajustar quantidades:** Modificar os `generate_series()` e `LIMIT`
2. **Mudar intervalos:** Alterar os `interval` para mais/menos histórico
3. **Personalizar nomes:** Substituir os arrays de nomes/placas/câmeras
4. **Adicionar cenários:** Criar novos tipos de eventos específicos

## ⚠️ Avisos Importantes

1. **IDs fixos:** Os UUIDs são fixos para facilitar referências
2. **Org ID:** Usa o primeiro org disponível (ajustar se necessário)
3. **Timestamps:** Relativos a `now()` - sempre atualizados
4. **Conflicts:** Usa `ON CONFLICT DO NOTHING` para evitar duplicatas
5. **Performance:** Script pode levar 30-60 segundos para executar

## 🔍 Verificação

Após executar o script, verifique:

```sql
-- Contagens
SELECT 
  (SELECT COUNT(*) FROM public.people WHERE metadata->>'type' = 'demo') as people,
  (SELECT COUNT(*) FROM public.events WHERE ts > now() - interval '7 days') as events,
  (SELECT COUNT(*) FROM public.vehicle_detections WHERE detected_at > now() - interval '7 days') as vehicles,
  (SELECT COUNT(*) FROM public.antitheft_incidents) as antitheft,
  (SELECT COUNT(*) FROM public.edu_incidents) as edu,
  (SELECT COUNT(*) FROM public.safety_events) as safety;
```

## 📞 Suporte

Para problemas ou dúvidas sobre os dados demo:
1. Verificar logs do PostgreSQL
2. Confirmar RLS policies
3. Validar org_id correto
4. Testar com dados menores primeiro
