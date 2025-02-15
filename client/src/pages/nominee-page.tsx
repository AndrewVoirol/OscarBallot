import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { NomineeDetails } from "@/components/nominee-details";
import { Skeleton } from "@/components/ui/skeleton";
import type { Nominee } from "@shared/schema";

export default function NomineePage() {
  const [, params] = useRoute("/nominees/:id");
  const nomineeId = params?.id ? parseInt(params.id) : undefined;

  const { data: nominee, isLoading } = useQuery<Nominee>({
    queryKey: ["/api/nominees", nomineeId],
    enabled: !!nomineeId,
  });

  if (isLoading || !nominee) {
    return (
      <div className="container max-w-screen-2xl py-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-screen-2xl py-6">
      <NomineeDetails nominee={nominee} />
    </div>
  );
}
