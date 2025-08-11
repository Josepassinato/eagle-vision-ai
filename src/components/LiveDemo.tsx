import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Users, Shield, AlertTriangle } from "lucide-react";

const LiveDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDemo, setCurrentDemo] = useState("retail");

  const demoScenarios = {
    retail: {
      title: "Demo: Loja de Roupas",
      subtitle: "Detecção de furto em tempo real",
      events: [
        { time: "14:23:15", type: "person_detected", message: "Pessoa detectada na entrada", icon: <Users className="h-4 w-4" />, color: "bg-blue-500" },
        { time: "14:23:18", type: "face_recognized", message: "Cliente reconhecido: Maria S.", icon: <Shield className="h-4 w-4" />, color: "bg-green-500" },
        { time: "14:23:45", type: "suspicious_behavior", message: "Comportamento suspeito detectado", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-yellow-500" },
        { time: "14:23:47", type: "alert", message: "🚨 ALERTA: Possível furto em andamento", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-red-500" },
      ]
    },
    office: {
      title: "Demo: Escritório Corporativo", 
      subtitle: "Controle de acesso por reconhecimento facial",
      events: [
        { time: "09:15:22", type: "person_detected", message: "Pessoa na entrada principal", icon: <Users className="h-4 w-4" />, color: "bg-blue-500" },
        { time: "09:15:25", type: "face_recognized", message: "Funcionário reconhecido: João P.", icon: <Shield className="h-4 w-4" />, color: "bg-green-500" },
        { time: "09:15:26", type: "access_granted", message: "✅ Acesso liberado automaticamente", icon: <Shield className="h-4 w-4" />, color: "bg-green-500" },
      ]
    },
    industry: {
      title: "Demo: Área Industrial",
      subtitle: "Monitoramento de EPI e segurança",
      events: [
        { time: "10:45:12", type: "person_detected", message: "Trabalhador detectado na área", icon: <Users className="h-4 w-4" />, color: "bg-blue-500" },
        { time: "10:45:15", type: "ppe_check", message: "Verificando uso de EPI...", icon: <Shield className="h-4 w-4" />, color: "bg-yellow-500" },
        { time: "10:45:16", type: "alert", message: "⚠️ ALERTA: Capacete não detectado", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-red-500" },
      ]
    }
  };

  const [currentEvents, setCurrentEvents] = useState<any[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup function to clear all timeouts
  const clearAllTimeouts = () => {
    timeoutRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutRef.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  const startDemo = () => {
    // Clear any existing timeouts
    clearAllTimeouts();
    
    setIsPlaying(true);
    setCurrentEvents([]);
    setEventIndex(0);
    
    const events = demoScenarios[currentDemo as keyof typeof demoScenarios].events;
    
    const showNextEvent = (index: number) => {
      if (index < events.length) {
        setCurrentEvents(prev => [...prev, events[index]]);
        setEventIndex(index + 1);
        const timeout = setTimeout(() => showNextEvent(index + 1), 2000);
        timeoutRef.current.push(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsPlaying(false);
          setCurrentEvents([]);
          setEventIndex(0);
        }, 3000);
        timeoutRef.current.push(timeout);
      }
    };
    
    showNextEvent(0);
  };

  const stopDemo = () => {
    clearAllTimeouts();
    setIsPlaying(false);
    setCurrentEvents([]);
    setEventIndex(0);
  };

  const demo = demoScenarios[currentDemo as keyof typeof demoScenarios];

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border">
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
        
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            {!isPlaying ? (
              <Button
                onClick={startDemo}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Demo
              </Button>
            ) : (
              <Button
                onClick={stopDemo}
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Pause className="h-4 w-4 mr-2" />
                Parar Demo
              </Button>
            )}
          </div>
          
          <select
            value={currentDemo}
            onChange={(e) => setCurrentDemo(e.target.value)}
            disabled={isPlaying}
            className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600"
          >
            <option value="retail">🏪 Loja</option>
            <option value="office">🏢 Escritório</option>
            <option value="industry">🏭 Indústria</option>
          </select>
        </div>
      </div>

      {/* Video Area */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-700">
        <div className="absolute inset-0 flex items-center justify-center">
          {!isPlaying && currentEvents.length === 0 && (
            <div className="text-center text-white">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold mb-2">Demonstração Interativa</p>
              <p className="text-gray-300">Clique em "Iniciar Demo" para ver a IA em ação</p>
            </div>
          )}
          
          {isPlaying && (
            <div className="text-center text-white">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                <Shield className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-lg font-semibold">IA Analisando...</p>
            </div>
          )}
        </div>

        {/* Overlay Information */}
        {isPlaying && (
          <>
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
              Camera 01 - Entrada Principal
            </div>
            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded text-sm">
              ✅ IA Ativa
            </div>
          </>
        )}
      </div>

      {/* Events Log */}
      <div className="bg-gray-50 p-4 min-h-[200px]">
        <h4 className="font-semibold mb-3 text-gray-800">Log de Eventos em Tempo Real</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {currentEvents.length === 0 && !isPlaying && (
            <p className="text-gray-500 text-sm italic">
              Inicie a demonstração para ver os eventos sendo detectados pela IA...
            </p>
          )}
          
          {currentEvents.map((event, index) => (
            <div
              key={`${event.type}-${index}`}
              className="flex items-center space-x-3 p-2 bg-white rounded border transition-all duration-300 opacity-100 transform translate-y-0"
              style={{ 
                animation: `slideInFromBottom 0.3s ease-out ${index * 0.1}s both`
              }}
            >
              <div className={`p-1 rounded-full text-white ${event.color}`}>
                {event.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{event.message}</span>
                  <span className="text-xs text-gray-500">{event.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveDemo;