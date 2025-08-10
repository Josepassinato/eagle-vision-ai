# Compliance & Privacy - Visão de Águia

Este documento descreve a implementação de compliance e privacidade para LGPD/FERPA.

## Componentes Implementados

### 1. Schema de Compliance
- **retention_policies**: Políticas de retenção de dados
- **privacy_consents**: Gestão de consentimentos
- **privacy_settings**: Configurações de privacidade por organização
- **audit_logs**: Trilha de auditoria completa
- **data_subject_requests**: Solicitações de titulares de dados

### 2. Controles de Privacidade
- **Face Blur**: Anonimização de faces em tempo real
- **License Plate Blur**: Ofuscamento de placas
- **Anonymization Mode**: Níveis de anonimização (none/partial/full)
- **Data Minimization**: Coleta apenas de dados necessários
- **Consent Management**: Consentimento explícito

### 3. Políticas de Retenção
- **Clips**: 30 dias (padrão)
- **Métricas**: 365 dias (padrão)
- **Eventos**: 90 dias
- **Logs**: 30 dias
- **Configurável por organização**

### 4. RBAC (Role-Based Access Control)
- **Owner**: Acesso total, pode deletar organização
- **Admin**: Gestão completa, exceto exclusão da org
- **Analyst**: Acesso aos dados e relatórios
- **Viewer**: Apenas visualização

### 5. Trilha de Auditoria
Todas as ações são registradas:
- **Create**: Criação de recursos
- **Read**: Acesso a dados sensíveis
- **Update**: Modificações
- **Delete**: Exclusões
- **Export**: Exportação de dados
- **Anonymize**: Ações de anonimização

## Compliance Frameworks

### LGPD (Lei Geral de Proteção de Dados)
- **Base Legal**: Consent, Legitimate Interest, Legal Obligation
- **Direitos do Titular**: Acesso, Retificação, Exclusão, Portabilidade
- **Prazo de Resposta**: 15 dias
- **Anonimização**: Opcional por configuração

### FERPA (Family Educational Rights and Privacy Act)
- **Educational Records**: Proteção de dados educacionais
- **Consent Requirements**: Consentimento para compartilhamento
- **Access Rights**: Acesso dos pais/estudantes aos dados
- **Directory Information**: Controle de informações públicas

### GDPR (General Data Protection Regulation)
- **Right to be Forgotten**: Exclusão de dados
- **Data Portability**: Exportação em formato estruturado
- **Privacy by Design**: Privacidade desde a concepção
- **Data Protection Officer**: Responsável pela proteção

## Endpoints de API

### Organizações
```bash
# Criar organização
POST /org/create
{
  "name": "Escola XYZ",
  "plan": "professional",
  "user_id": "uuid"
}

# Rotacionar chave da API
POST /org/apikey/rotate
Authorization: Bearer <token>
```

### Uso e Billing
```bash
# Resumo de uso mensal
GET /usage/summary?month=2025-08
X-Org-ID: <org_id>

# Checkout do Stripe
POST /billing/checkout
{
  "plan": "professional",
  "org_id": "uuid"
}
```

### Streams e Câmeras
```bash
# Adicionar câmera
POST /camera/add
{
  "name": "Entrada Principal",
  "stream_url": "rtsp://...",
  "location": "Portaria"
}

# Iniciar stream
POST /stream/start
{
  "camera_id": "cam123",
  "analytics": ["peoplevision", "safetyvision"]
}

# Parar stream
POST /stream/stop
{
  "stream_id": "uuid"
}
```

## Configuração de Middleware

O middleware resolve org_id via:
1. **Sessão autenticada**: Para usuários logados
2. **X-API-Key header**: Para integrações externas

```typescript
// Middleware example
function resolveOrgId(req: Request): string {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    // Validate API key and return org_id
    return validateApiKey(apiKey);
  }
  
  const session = getSession(req);
  if (session?.user_id) {
    // Get org_id from user's org membership
    return getUserOrgId(session.user_id);
  }
  
  throw new Error('Unauthorized');
}

// Set RLS context
await supabase.rpc('set_config', {
  parameter: 'request.org_id',
  value: orgId
});
```

## Anonimização em Tempo Real

### Face Blur
```javascript
// Detecção e blur de faces
const detectAndBlurFaces = async (frameData) => {
  const faces = await faceDetector.detect(frameData);
  return applyBlur(frameData, faces, blurRadius);
};
```

### License Plate Blur
```javascript
// Detecção e blur de placas
const detectAndBlurPlates = async (frameData) => {
  const plates = await plateDetector.detect(frameData);
  return applyBlur(frameData, plates, blurRadius);
};
```

## Solicitações de Titular de Dados

### Tipos de Solicitação
- **Access**: Acesso aos dados pessoais
- **Rectification**: Correção de dados incorretos
- **Erasure**: Exclusão de dados (direito ao esquecimento)
- **Portability**: Exportação em formato estruturado
- **Restriction**: Limitação do processamento

### Fluxo de Atendimento
1. **Recebimento**: Registro da solicitação
2. **Verificação**: Validação da identidade
3. **Processamento**: Execução da solicitação
4. **Resposta**: Comunicação ao titular
5. **Auditoria**: Registro da ação

## Configuração de Produção

### Variáveis de Ambiente
```bash
COMPLIANCE_FRAMEWORK=LGPD
DEFAULT_RETENTION_DAYS=30
ANONYMIZATION_ENABLED=true
AUDIT_LOG_RETENTION=365
FACE_BLUR_DEFAULT=false
PLATE_BLUR_DEFAULT=false
```

### Backup e Disaster Recovery
- **Backups encriptados**: Proteção de dados sensíveis
- **Retenção de backup**: Conforme políticas de compliance
- **Teste de restore**: Validação periódica
- **Documentação**: Registro de procedimentos

## Monitoramento de Compliance

### Métricas
- **Data Retention Compliance**: % dados dentro do prazo
- **Consent Coverage**: % dados com consentimento válido
- **Request Response Time**: Tempo médio de resposta
- **Anonymization Rate**: % dados anonimizados
- **Audit Log Coverage**: % ações auditadas

### Alertas
- **Retention Violation**: Dados fora do prazo de retenção
- **Missing Consent**: Processamento sem consentimento
- **Failed Anonymization**: Falha na anonimização
- **Overdue Requests**: Solicitações em atraso
- **Audit Gaps**: Falhas na auditoria