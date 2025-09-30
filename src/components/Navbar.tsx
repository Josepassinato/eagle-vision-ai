import { Button } from "@/components/ui/button";
import { Eye, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./LanguageSelector";
const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthed, setAuthed] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });
    return () => subscription.unsubscribe();
  }, []);

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
              {t('hero.title')}
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {isAuthed ? (
              <>
                <TopNavLink to="/dashboard-simple">{t('nav.dashboard')}</TopNavLink>
                <TopNavLink to="/setup">Configurar</TopNavLink>
                <TopNavLink to="/app/dashboard">Avançado</TopNavLink>
              </>
            ) : (
              <>
                <TopNavLink to="/#produtos">{t('nav.products')}</TopNavLink>
                <TopNavLink to="/#precos">{t('nav.pricing')}</TopNavLink>
                <TopNavLink to="/#sobre">{t('nav.about')}</TopNavLink>
                
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSelector />
            {isAuthed ? (
              <Button variant="accent" size="sm" asChild>
                <NavLink to="/dashboard-simple" aria-label="Ir para o painel">{t('nav.dashboard')}</NavLink>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <NavLink to="/auth" aria-label="Entrar">{t('nav.login')}</NavLink>
                </Button>
                <Button variant="accent" size="sm" asChild>
                  <NavLink to="/auth" aria-label="Criar conta">{t('nav.login')}</NavLink>
                </Button>
              </>
            )}
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
              {isAuthed ? (
                <>
                  <TopNavLink to="/dashboard-simple" mobile>{t('nav.dashboard')}</TopNavLink>
                  <TopNavLink to="/setup" mobile>Configurar</TopNavLink>
                  <TopNavLink to="/app/dashboard" mobile>Avançado</TopNavLink>
                  <div className="flex flex-col space-y-2 pt-4">
                    <Button variant="accent" size="sm" asChild>
                      <NavLink to="/dashboard-simple">{t('nav.dashboard')}</NavLink>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <TopNavLink to="/#produtos" mobile>{t('nav.products')}</TopNavLink>
                  <TopNavLink to="/#precos" mobile>{t('nav.pricing')}</TopNavLink>
                  <TopNavLink to="/#sobre" mobile>{t('nav.about')}</TopNavLink>
                  
                  <div className="flex flex-col space-y-2 pt-4">
                    <Button variant="ghost" size="sm" className="justify-start" asChild>
                      <NavLink to="/auth">{t('nav.login')}</NavLink>
                    </Button>
                    <Button variant="accent" size="sm" asChild>
                      <NavLink to="/auth">{t('nav.login')}</NavLink>
                    </Button>
                  </div>
                </>
              )}
              
              <div className="pt-4 border-t border-border/50">
                <LanguageSelector />
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