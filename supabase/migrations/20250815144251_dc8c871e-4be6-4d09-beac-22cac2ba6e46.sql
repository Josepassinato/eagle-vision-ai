-- Limpar todas as configurações de DVR existentes
DELETE FROM dvr_configs;

-- Limpar todas as demo sources existentes  
DELETE FROM demo_sources;

-- Inserir apenas os 4 streams essenciais mapeados para cada analítico
INSERT INTO demo_sources (name, url, analytic, protocol, active, location, confidence) VALUES
('EduBehavior - Fluxo de Pessoas', 'rtsp://demo-office.internal/stream1', 'edubehavior', 'generic', true, 'Escritório', 75),
('LPR - Leitura de Placas', 'rtsp://demo-parking.internal/stream1', 'lpr', 'generic', true, 'Estacionamento', 80),
('Antifurto - Monitoramento Varejo', 'rtsp://demo-retail.internal/stream1', 'antitheft', 'generic', true, 'Loja', 70),
('SafetyVision - Segurança Trabalho', 'rtsp://demo-security.internal/stream1', 'safety', 'generic', true, 'Obra/Fábrica', 85);

-- Inserir configurações de DVR correspondentes
INSERT INTO dvr_configs (name, host, protocol, username, password, channel, port, stream_quality, transport_protocol) VALUES
('EduBehavior - Fluxo de Pessoas', 'demo-office.internal', 'generic', 'demo', 'demo123', 1, 554, 'main', 'tcp'),
('LPR - Leitura de Placas', 'demo-parking.internal', 'generic', 'demo', 'demo123', 1, 554, 'main', 'tcp'),
('Antifurto - Monitoramento Varejo', 'demo-retail.internal', 'generic', 'demo', 'demo123', 1, 554, 'main', 'tcp'),
('SafetyVision - Segurança Trabalho', 'demo-security.internal', 'generic', 'demo', 'demo123', 1, 554, 'main', 'tcp');