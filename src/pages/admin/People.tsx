import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaceEnrollment } from "@/components/FaceEnrollment";
import { FaceMatches } from "@/components/FaceMatches";
import { ReIDMatching } from "@/components/ReIDMatching";
import { Users, Search, UserPlus, ScanFace } from "lucide-react";

export default function People() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          Reconhecimento de Pessoas
        </h2>
        <p className="text-muted-foreground mt-1">
          Sistema completo de identificação: facial (ArcFace) e corporal (OSNet Re-ID)
        </p>
      </div>

      <Tabs defaultValue="enroll" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="enroll" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastrar Face
          </TabsTrigger>
          <TabsTrigger value="face-search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar Face
          </TabsTrigger>
          <TabsTrigger value="reid-search" className="flex items-center gap-2">
            <ScanFace className="h-4 w-4" />
            Re-ID Corporal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enroll" className="space-y-4">
          <FaceEnrollment />
        </TabsContent>

        <TabsContent value="face-search" className="space-y-4">
          <FaceMatches />
        </TabsContent>

        <TabsContent value="reid-search" className="space-y-4">
          <ReIDMatching />
        </TabsContent>
      </Tabs>
    </div>
  );
}
