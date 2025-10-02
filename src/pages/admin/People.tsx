import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaceEnrollment } from "@/components/FaceEnrollment";
import { FaceMatches } from "@/components/FaceMatches";
import { Users, Search, UserPlus } from "lucide-react";

export default function People() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          Reconhecimento Facial
        </h2>
        <p className="text-muted-foreground mt-1">
          Gerencie e busque pessoas usando reconhecimento facial com ArcFace
        </p>
      </div>

      <Tabs defaultValue="enroll" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="enroll" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastrar
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enroll" className="space-y-4">
          <FaceEnrollment />
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <FaceMatches />
        </TabsContent>
      </Tabs>
    </div>
  );
}
