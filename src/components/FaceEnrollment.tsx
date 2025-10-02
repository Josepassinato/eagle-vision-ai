import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, UserPlus, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const FaceEnrollment = () => {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnroll = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insira o nome da pessoa",
        variant: "destructive",
      });
      return;
    }

    if (!imageFile) {
      toast({
        title: "Foto obrigatória",
        description: "Por favor, selecione uma foto",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = (reader.result as string).split(',')[1];

        try {
          // Call face service to add person
          const response = await fetch(`${import.meta.env.VITE_FACE_SERVICE_URL || 'http://localhost:8017'}/person`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: name.trim(),
              image_b64: base64Image,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Erro ao processar face");
          }

          const result = await response.json();

          toast({
            title: "Pessoa cadastrada!",
            description: `${result.name} foi adicionado(a) ao sistema com sucesso`,
          });

          // Reset form
          setName("");
          setImageFile(null);
          setImagePreview(null);
        } catch (error: any) {
          console.error("Error enrolling person:", error);
          toast({
            title: "Erro ao cadastrar",
            description: error.message || "Não foi possível processar a foto",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsDataURL(imageFile);
    } catch (error: any) {
      console.error("Error reading file:", error);
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível processar a imagem",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Cadastrar Pessoa
        </CardTitle>
        <CardDescription>
          Adicione uma nova pessoa ao sistema de reconhecimento facial
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da Pessoa</Label>
          <Input
            id="name"
            placeholder="Digite o nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-2">
          <Label>Foto</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mx-auto max-h-64 rounded-lg"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  disabled={isProcessing}
                >
                  Trocar Foto
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Clique para selecionar uma foto
                  </p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isProcessing}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: Use uma foto frontal, bem iluminada e com o rosto visível
          </p>
        </div>

        <Button
          onClick={handleEnroll}
          disabled={isProcessing || !name.trim() || !imageFile}
          className="w-full"
        >
          {isProcessing ? (
            <>Processando...</>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Cadastrar Pessoa
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
