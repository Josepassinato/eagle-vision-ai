import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function GlobalNavActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isAuthed, setAuthed] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Erro ao sair", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sessão encerrada", description: "Você saiu com sucesso." });
    navigate("/auth", { replace: true, state: { from: location.pathname } });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background/90 backdrop-blur px-2 py-2 shadow-primary">
        <Button variant="ghost" size="sm" onClick={goBack} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Voltar</span>
        </Button>
        {isAuthed && (
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair">
            <LogOut className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Sair</span>
          </Button>
        )}
      </div>
    </div>
  );
}
