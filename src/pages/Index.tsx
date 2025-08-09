import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MediaGatewayCard from "@/components/MediaGatewayCard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MediaGatewayCard />
    </div>
  );
};

export default Index;
