import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Zap, Target, Brain } from "lucide-react";
import heroImage from "@/assets/eagle-vision-hero.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Visão de Águia – tecnologia de IA em visão computacional"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-hero/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <Badge 
          variant="outline" 
          className="mb-6 px-4 py-2 text-accent border-accent/30 bg-accent/10 animate-pulse-glow"
        >
          <Zap className="w-4 h-4 mr-2" />
          Tecnologia de Visão Computacional Avançada
        </Badge>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
          Visão de Águia
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
          Sistema de inteligência artificial com precisão cirúrgica para análise visual.
          Detecte, analise e processe imagens com a acuidade de uma águia.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button variant="hero" size="lg" className="text-lg">
            <Eye className="w-5 h-5 mr-2" />
            Iniciar Análise
          </Button>
          <Button variant="tech" size="lg" className="text-lg">
            <Brain className="w-5 h-5 mr-2" />
            Explorar Sistema
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <FeatureCard
            icon={<Target className="w-8 h-8" />}
            title="Precisão Extrema"
            description="Análise detalhada com precisão de 99.8% em reconhecimento de padrões"
          />
          <FeatureCard
            icon={<Eye className="w-8 h-8" />}
            title="Visão Aprimorada"
            description="Processamento avançado de imagens com algoritmos de deep learning"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Velocidade Extrema"
            description="Análise em tempo real com processamento otimizado"
          />
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-3 h-3 bg-accent rounded-full animate-float opacity-60" />
      <div className="absolute top-40 right-20 w-2 h-2 bg-primary rounded-full animate-float opacity-40" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-32 left-20 w-4 h-4 bg-accent/50 rounded-full animate-float opacity-30" style={{ animationDelay: "2s" }} />
    </section>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <div className="group bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 hover:bg-card/70 hover:border-accent/30 transition-all duration-300">
      <div className="text-accent mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

export default HeroSection;