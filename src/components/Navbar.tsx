import { Button } from "@/components/ui/button";
import { Eye, Menu, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Eye className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-2xl font-display font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
              Visão de Águia
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <TopNavLink to="/live">Live</TopNavLink>
            <TopNavLink to="/events">Events</TopNavLink>
            <TopNavLink to="/analytics">Analytics</TopNavLink>
            <TopNavLink to="/app/dashboard">Admin</TopNavLink>
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <NavLink to="/auth" aria-label="Login">Login</NavLink>
            </Button>
            <Button variant="accent" size="sm" asChild>
              <NavLink to="/auth" aria-label="Começar Agora">Começar Agora</NavLink>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 py-4 border-t border-border/50">
            <div className="flex flex-col space-y-4">
              <TopNavLink to="/live" mobile>Live</TopNavLink>
              <TopNavLink to="/events" mobile>Events</TopNavLink>
              <TopNavLink to="/analytics" mobile>Analytics</TopNavLink>
              <TopNavLink to="/app/dashboard" mobile>Admin</TopNavLink>
              <div className="flex flex-col space-y-2 pt-4">
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <NavLink to="/auth">Login</NavLink>
                </Button>
                <Button variant="accent" size="sm" asChild>
                  <NavLink to="/auth">Começar Agora</NavLink>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

interface TopNavLinkProps {
  to: string;
  children: React.ReactNode;
  mobile?: boolean;
}

const TopNavLink = ({ to, children, mobile = false }: TopNavLinkProps) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `transition-colors duration-300 ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"} ${mobile ? "py-2" : ""}`}
      aria-label={`Ir para ${typeof children === 'string' ? children : 'página'}`}
    >
      {children}
    </NavLink>
  );
};

export default Navbar;