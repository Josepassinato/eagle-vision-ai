import { Button } from "@/components/ui/button";
import { Eye, Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Eye className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
              Visão de Águia
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="#inicio">Início</NavLink>
            <NavLink href="#sistema">Sistema</NavLink>
            <NavLink href="#recursos">Recursos</NavLink>
            <NavLink href="#contato">Contato</NavLink>
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              Login
            </Button>
            <Button variant="accent" size="sm">
              Começar Agora
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 py-4 border-t border-border/50">
            <div className="flex flex-col space-y-4">
              <NavLink href="#inicio" mobile>Início</NavLink>
              <NavLink href="#sistema" mobile>Sistema</NavLink>
              <NavLink href="#recursos" mobile>Recursos</NavLink>
              <NavLink href="#contato" mobile>Contato</NavLink>
              <div className="flex flex-col space-y-2 pt-4">
                <Button variant="ghost" size="sm" className="justify-start">
                  Login
                </Button>
                <Button variant="accent" size="sm">
                  Começar Agora
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  mobile?: boolean;
}

const NavLink = ({ href, children, mobile = false }: NavLinkProps) => {
  return (
    <a
      href={href}
      className={`transition-colors duration-300 hover:text-accent ${
        mobile ? "text-foreground py-2" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </a>
  );
};

export default Navbar;