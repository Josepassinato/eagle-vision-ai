import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Users, Shield, AlertTriangle } from "lucide-react";

const LiveDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDemo, setCurrentDemo] = useState("retail");
  const [currentEvents, setCurrentEvents] = useState<any[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const demoScenarios = {
    retail: {
      title: "Demo: Loja de Roupas",
      subtitle: "Detecção de furto em tempo real",
      image: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&h=450&fit=crop&auto=format",
      events: [
        { 
          time: "14:23:15", 
          message: "Pessoa detectada na entrada", 
          icon: Users, 
          color: "bg-blue-500" 
        },
        { 
          time: "14:23:18", 
          message: "Cliente reconhecido: Maria S.", 
          icon: Shield, 
          color: "bg-green-500" 
        },
        { 
          time: "14:23:45", 
          message: "Comportamento suspeito detectado", 
          icon: AlertTriangle, 
          color: "bg-yellow-500" 
        },
        { 
          time: "14:23:47", 
          message: "🚨 ALERTA: Possível furto em andamento", 
          icon: AlertTriangle, 
          color: "bg-red-500" 
        },
      ]
    },
    office: {
      title: "Demo: Escritório Corporativo", 
      subtitle: "Controle de acesso por reconhecimento facial",
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=450&fit=crop&auto=format",
      events: [
        { 
          time: "09:15:22", 
          message: "Pessoa na entrada principal", 
          icon: Users, 
          color: "bg-blue-500" 
        },
        { 
          time: "09:15:25", 
          message: "Funcionário reconhecido: João P.", 
          icon: Shield, 
          color: "bg-green-500" 
        },
        { 
          time: "09:15:26", 
          message: "✅ Acesso liberado automaticamente", 
          icon: Shield, 
          color: "bg-green-500" 
        },
      ]
    },
    industry: {
      title: "Demo: Área Industrial",
      subtitle: "Monitoramento de EPI e segurança",
      image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&h=450&fit=crop&auto=format",
      events: [
        { 
          time: "10:45:12", 
          message: "Trabalhador detectado na área", 
          icon: Users, 
          color: "bg-blue-500" 
        },
        { 
          time: "10:45:15", 
          message: "Verificando uso de EPI...", 
          icon: Shield, 
          color: "bg-yellow-500" 
        },
        { 
          time: "10:45:16", 
          message: "⚠️ ALERTA: Capacete não detectado", 
          icon: AlertTriangle, 
          color: "bg-red-500" 
        },
      ]
    }
  };

  const demo = demoScenarios[currentDemo as keyof typeof demoScenarios];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentEventIndex(prev => {
          const nextIndex = prev + 1;
          
          if (nextIndex <= demo.events.length) {
            const newEvent = demo.events[nextIndex - 1];
            if (newEvent) {
              setCurrentEvents(prevEvents => [...prevEvents, newEvent]);
            }
            
            if (nextIndex >= demo.events.length) {
              setTimeout(() => {
                setIsPlaying(false);
                setCurrentEvents([]);
                setCurrentEventIndex(0);
              }, 3000);
            }
            
            return nextIndex;
          }
          
          return prev;
        });
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, demo.events]);

  const startDemo = () => {
    console.log("Starting demo..."); 
    setIsPlaying(true);
    setCurrentEvents([]);
    setCurrentEventIndex(0);
  };

  const stopDemo = () => {
    console.log("Stopping demo..."); 
    setIsPlaying(false);
    setCurrentEvents([]);
    setCurrentEventIndex(0);
  };

  const changeDemo = (newDemo: string) => {
    if (!isPlaying) {
      setCurrentDemo(newDemo);
      setCurrentEvents([]);
      setCurrentEventIndex(0);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border max-w-4xl mx-auto">
      {/* Demo Controls */}
      <div className="bg-gray-900 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{demo.title}</h3>
            <p className="text-gray-300 text-sm">{demo.subtitle}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="destructive" className="animate-pulse">🔴 AO VIVO</Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 flex-wrap">
          <div className="flex space-x-2">
            {!isPlaying ? (
              <Button
                onClick={startDemo}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Demo
              </Button>
            ) : (
              <Button
                onClick={stopDemo}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Pause className="h-4 w-4 mr-2" />
                Parar Demo
              </Button>
            )}
          </div>
          
          <select
            value={currentDemo}
            onChange={(e) => changeDemo(e.target.value)}
            disabled={isPlaying}
            className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600 disabled:opacity-50"
          >
            <option value="retail">🏪 Loja</option>
            <option value="office">🏢 Escritório</option>
            <option value="industry">🏭 Indústria</option>
          </select>
        </div>
      </div>

      {/* Video Area with CCTV Effects */}
      <div className="relative aspect-video overflow-hidden bg-gray-900">
        {/* Background Image with CCTV Effects */}
        {isPlaying && (
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${demo.image})`,
              filter: 'contrast(1.1) brightness(0.9)',
              animation: 'cctvEffect 8s infinite linear'
            }}
          >
            {/* CCTV Scan Lines */}
            <div 
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.1) 2px, rgba(0,255,0,0.1) 4px)',
                animation: 'scanlines 2s linear infinite'
              }}
            />
            
            {/* Static Noise */}
            <div 
              className="absolute inset-0 pointer-events-none z-10 opacity-20"
              style={{
                background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cdefs%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.4'/%3E%3C/svg%3E")`,
                animation: 'staticNoise 0.1s infinite linear'
              }}
            />
          </div>
        )}
        
        {/* Default state */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-700" />
        )}
        
        {/* Content Overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          {!isPlaying && currentEvents.length === 0 && (
            <div className="text-center text-white">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center backdrop-blur-sm">
                <Play className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-lg font-semibold mb-2">Demonstração Interativa</p>
              <p className="text-gray-300 text-center px-4">Clique em "Iniciar Demo" para ver a IA detectando eventos em tempo real</p>
            </div>
          )}
          
          {isPlaying && (
            <div className="text-center text-white">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/30 flex items-center justify-center animate-pulse backdrop-blur-sm border-2 border-green-400/50">
                <Shield className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-lg font-semibold drop-shadow-lg">🤖 IA Analisando...</p>
              <p className="text-sm text-gray-200 mt-2 drop-shadow-lg">Processando imagens em tempo real</p>
            </div>
          )}
        </div>

        {/* CCTV Info Overlays */}
        {isPlaying && (
          <div className="absolute inset-0 z-30">
            <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-1 rounded text-sm font-mono">
              📹 CAM-01 {currentDemo === 'office' ? 'LOBBY' : currentDemo === 'industry' ? 'PROD-FLOOR' : 'ENTRANCE'}
            </div>
            <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded text-sm">
              ✅ AI ACTIVE
            </div>
            <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-1 rounded text-sm font-mono">
              🕐 {new Date().toLocaleTimeString()}
            </div>
            <div className="absolute bottom-4 right-4 bg-red-600 text-white px-3 py-1 rounded text-sm animate-pulse font-mono">
              ● REC
            </div>
          </div>
        )}
      </div>

      {/* Events Log */}
      <div className="bg-gray-50 p-4 min-h-[200px]">
        <h4 className="font-semibold mb-3 text-gray-800">📋 Log de Eventos em Tempo Real</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {currentEvents.length === 0 && !isPlaying && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm italic mb-2">
                Inicie a demonstração para ver os eventos sendo detectados pela IA...
              </p>
              <p className="text-xs text-gray-400">
                A IA processa as imagens e gera alertas conforme configurado
              </p>
            </div>
          )}
          
          {currentEvents.map((event, index) => {
            const IconComponent = event.icon;
            return (
              <div
                key={`event-${index}-${Date.now()}`}
                className="flex items-center space-x-3 p-3 bg-white rounded-lg border shadow-sm transition-all duration-300"
                style={{
                  animation: `fadeIn 0.5s ease-out ${index * 0.2}s both`
                }}
              >
                <div className={`p-2 rounded-full text-white ${event.color}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{event.message}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">{event.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
          
          {isPlaying && currentEvents.length === 0 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Aguardando primeiro evento...</span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default LiveDemo;