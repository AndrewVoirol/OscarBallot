import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import type { Ballot } from "@shared/schema";

interface VotingControlsProps {
  nomineeId: number;
  isHistorical?: boolean;
}

export function VotingControls({ nomineeId, isHistorical = false }: VotingControlsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: ballot } = useQuery<Ballot>({
    queryKey: [`/api/ballots/${nomineeId}`],
    enabled: !!user, // Only fetch if user is logged in
  });

  const mutation = useMutation({
    mutationFn: async (newBallot: Partial<Ballot>) => {
      const res = await apiRequest("POST", "/api/ballots", {
        nomineeId,
        ...ballot,
        ...newBallot,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ballots/${nomineeId}`] });
      toast({
        title: "Vote updated",
        description: "Your ballot has been updated successfully",
      });
    },
  });

  const handleAction = (field: keyof Omit<Ballot, "id" | "nomineeId" | "userId">) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login or register to track your Oscar picks",
        variant: "default",
      });
      setLocation("/auth");
      return;
    }
    mutation.mutate({ [field]: !ballot?.[field] });
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-2">
      <Button
        variant={ballot?.hasWatched ? "default" : "outline"}
        size="lg"
        className="h-12 sm:h-9 text-base sm:text-sm w-full justify-center"
        onClick={() => handleAction("hasWatched")}
      >
        {ballot?.hasWatched ? "Watched" : "Not Watched"}
      </Button>
      {!isHistorical && (
        <>
          <Button
            variant={ballot?.predictedWinner ? "default" : "outline"}
            size="lg"
            className="h-12 sm:h-9 text-base sm:text-sm w-full justify-center"
            onClick={() => handleAction("predictedWinner")}
          >
            {ballot?.predictedWinner ? "Predicted Winner" : "Predict Winner"}
          </Button>
          <Button
            variant={ballot?.wantToWin ? "default" : "outline"}
            size="lg"
            className="h-12 sm:h-9 text-base sm:text-sm w-full justify-center"
            onClick={() => handleAction("wantToWin")}
          >
            {ballot?.wantToWin ? "Want to Win" : "Pick to Win"}
          </Button>
        </>
      )}
    </div>
  );
}