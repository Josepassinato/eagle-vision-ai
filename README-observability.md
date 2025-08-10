# Observabilidade & SRE - Visão de Águia

Este documento descreve a implementação da observabilidade e SRE mínimo para o sistema Visão de Águia.

## Arquitetura

### Componentes

- **Prometheus**: Coleta de métricas
- **Grafana**: Visualização de dashboards
- **Loki**: Agregação de logs
- **Promtail**: Coleta de logs
- **AlertManager**: Gerenciamento de alertas
- **Backup Service**: Backup automatizado

### Métricas Monitoradas

#### Performance
- FPS médio por câmera
- Latência P90/P95 por stage (YOLO, Face, ReID, Decision)
- Queue length por worker
- Taxa de erro por serviço

#### Recursos
- CPU utilização por worker
- Memória utilização por worker
- GPU utilização (quando disponível)
- Espaço em disco
- I/O de rede

#### Business
- Eventos processados por minuto
- Detecções por classe (pessoa/veículo)
- Incidentes por severidade
- Tempo de resposta de alertas

## Alertas Configurados

### Críticos
- `CameraOffline`: Câmera offline > 2 min
- `DiskSpaceLow`: Espaço < 10%
- `BackupFailed`: Falha no backup diário
- `CircuitBreakerOpen`: Circuit breaker aberto

### Warnings
- `FusionLatencyHigh`: Latência P90 > 1.5s
- `PullerErrorRateHigh`: Taxa erro > 10%
- `StreamBacklogHigh`: Queue > 50 items
- `GPUUtilizationHigh`: GPU > 90%
- `MemoryUsageHigh`: Memória > 90%

## Logs Estruturados

### Formato
Todos os logs seguem o formato:
```
[TIMESTAMP] LEVEL [ORG_ID] [STREAM_ID] [ANALYTIC] MESSAGE
```

### Labels Loki
- `org_id`: Identificador da organização
- `stream_id`: Identificador do stream
- `analytic`: Tipo de análise (peoplevision, vehiclevision, etc.)
- `level`: Nível do log (INFO, WARN, ERROR)
- `service`: Nome do serviço

## Backup & Disaster Recovery

### Backup Diário
- **Database**: Dump completo do PostgreSQL
- **Storage**: Sync de todos os buckets do Supabase
- **Métricas**: Prometheus data retention (200h)
- **Logs**: Loki retention configurável

### Monitoramento de Backup
- Métricas Prometheus para backup success/failure
- Alertas para backup atrasado (>24h)
- Tamanho dos backups monitorado

## Deploy

### Local/Development
```bash
docker-compose -f docker-compose.observability.yml up -d
```

### Production
Usar Helm chart com valores específicos para observabilidade:
```bash
helm upgrade --install monitoring ./charts/ai-runner \
  --set monitoring.enabled=true \
  --set grafana.enabled=true \
  --set prometheus.enabled=true
```

## Acesso

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **AlertManager**: http://localhost:9093
- **Loki**: http://localhost:3100

## Dashboards

### 1. Performance (desempenho.json)
- Latência por stage
- FPS do frame puller
- Taxa de sucesso
- Decisões por razão

### 2. Sistema (sistema.json)
- CPU/Memória por worker
- Queue length
- GPU utilização

### 3. Fluxo (fluxo.json)
- Contagem por classe/direção
- Taxa de cruzamento
- Eventos por câmera

## SLAs

### Targets
- **Disponibilidade**: 99.5% uptime
- **Latência**: P95 < 2s end-to-end
- **FPS**: Mínimo 15 FPS por stream
- **Detecção**: 0 falsos negativos críticos

### Alerting
- Alertas críticos: Resposta < 5 min
- Alertas warning: Resposta < 30 min
- Escalation automática após 15 min

## Troubleshooting

### Performance Issues
1. Verificar métricas de GPU/CPU
2. Analisar queue length por worker
3. Verificar logs de erro por analytic
4. Revisar latência por stage

### Connectivity Issues
1. Verificar status das câmeras
2. Analisar logs do frame puller
3. Verificar taxa de erro HTTP
4. Testar conectividade de rede

### Backup Issues
1. Verificar logs do backup service
2. Analisar métricas de backup failure
3. Verificar espaço em disco
4. Testar conectividade Supabase