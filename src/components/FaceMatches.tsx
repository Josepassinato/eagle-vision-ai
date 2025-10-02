import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Camera, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Match {
  id: string;
  name: string;
  similarity: number;
}

export const FaceMatches = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
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
      setMatches([]); // Clear previous matches
    }
  };

  const handleSearch = async () => {
    if (!imageFile) {
      toast({
        title: "Foto obrigatória",
        description: "Por favor, selecione uma foto para buscar",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = (reader.result as string).split(',')[1];

        try {
          // Call face service to match
          const response = await fetch(`${import.meta.env.VITE_FACE_SERVICE_URL || 'http://localhost:8017'}/match`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_b64: base64Image,
              top_k: 5,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Erro ao buscar faces");
          }

          const result = await response.json();
          setMatches(result.matches || []);

          if (result.matches.length === 0) {
            toast({
              title: "Nenhuma correspondência",
              description: "Não encontramos faces similares no banco de dados",
            });
          } else {
            toast({
              title: "Busca concluída",
              description: `Encontradas ${result.matches.length} correspondência(s)`,
            });
          }
        } catch (error: any) {
          console.error("Error searching faces:", error);
          toast({
            title: "Erro na busca",
            description: error.message || "Não foi possível processar a foto",
            variant: "destructive",
          });
        } finally {
          setIsSearching(false);
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
      setIsSearching(false);
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return "bg-green-500";
    if (similarity >= 0.6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getSimilarityLabel = (similarity: number) => {
    if (similarity >= 0.8) return "Alta";
    if (similarity >= 0.6) return "Média";
    return "Baixa";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Buscar Face
        </CardTitle>
        <CardDescription>
          Encontre pessoas similares no banco de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Foto para Busca</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
            {imagePreview ? (
              <div className="space-y-4">
                <img
                  src={imagePreview}
                  alt="Search"
                  className="mx-auto max-h-64 rounded-lg"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setMatches([]);
                  }}
                  disabled={isSearching}
                >
                  Trocar Foto
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Selecione uma foto para buscar
                  </p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isSearching}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={isSearching || !imageFile}
          className="w-full"
        >
          {isSearching ? (
            <>Buscando...</>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Buscar Faces Similares
            </>
          )}
        </Button>

        {matches.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Resultados ({matches.length})</h3>
            <div className="space-y-2">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{match.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {match.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge
                      variant="secondary"
                      className={`${getSimilarityColor(match.similarity)} text-white`}
                    >
                      {getSimilarityLabel(match.similarity)}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {(match.similarity * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
