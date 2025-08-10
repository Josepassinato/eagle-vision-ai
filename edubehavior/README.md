# EduBehavior – Análise Comportamental em Sala de Aula

Este serviço sinaliza padrões comportamentais observáveis para revisão HUMANA, sem diagnósticos. Implementa endpoints mínimos e integrações para persistência no Supabase.

Avisos de ética e governança:
- Consentimento da instituição e responsáveis (FERPA/LGPD)
- Sem reconhecimento facial público; controle por papéis/roles
- Retenção mínima necessária; auditoria via edu_reviews
- Human-in-the-loop: todos os alertas exigem revisão antes de ação

Endpoints:
- GET /health → status
- POST /analyze_frame → recebe frame + tracks; retorna {signals, incidents, telemetry}
- POST /review → registra decisão humana e atualiza incidente

Ambiente necessário:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- EDU_NOTIFY_MIN_SEVERITY (ex: HIGH)
- ALLOWED_ORIGINS (ex: *)

Execução local:
- pip install -r requirements.txt
- python main.py

