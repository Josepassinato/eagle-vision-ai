import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

function cleanupAuthState() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
        localStorage.removeItem(key);
      }
    });
    if (typeof sessionStorage !== "undefined") {
      Object.keys(sessionStorage).forEach((key) => {
        // @ts-ignore
        if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
          // @ts-ignore
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch {}
}

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Check if user has completed onboarding
        const hasCompletedOnboarding = localStorage.getItem("onboardingConfig");
        if (hasCompletedOnboarding) {
          window.location.href = "/app/dashboard";
        } else {
          window.location.href = "/onboarding";
        }
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const hasCompletedOnboarding = localStorage.getItem("onboardingConfig");
        if (hasCompletedOnboarding) {
          window.location.href = "/app/dashboard";
        } else {
          window.location.href = "/onboarding";
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      cleanupAuthState();
      await supabase.auth.signOut({ scope: "global" }).catch(() => {});
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check if user has completed onboarding
        const hasCompletedOnboarding = localStorage.getItem("onboardingConfig");
        if (hasCompletedOnboarding) {
          window.location.href = "/app/dashboard";
        } else {
          window.location.href = "/onboarding";
        }
      } else {
        const redirectUrl = `${window.location.origin}/onboarding`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        toast({ title: "Verifique seu e-mail", description: "Confirme o cadastro para entrar." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || String(err) });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-primary">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Entrar" : "Criar conta"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Senha</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button className="w-full" type="submit">
              {mode === "signin" ? "Entrar" : "Cadastrar"}
            </Button>
          </form>
          <div className="text-sm text-muted-foreground mt-4">
            {mode === "signin" ? (
              <button className="underline" onClick={() => setMode("signup")}>Não tem conta? Cadastre-se</button>
            ) : (
              <button className="underline" onClick={() => setMode("signin")}>Já tem conta? Entrar</button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
