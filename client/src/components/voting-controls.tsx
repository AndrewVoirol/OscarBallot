import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import type { Ballot } from "@shared/schema";

interface VotingControlsProps {
  nomineeId: number;
}

export function VotingControls({ nomineeId }: VotingControlsProps) {
  const { toast } = useToast();
  
  const { data: ballot } = useQuery<Ballot>({
    queryKey: [`/api/ballots/${nomineeId}`],
  });

  const mutation = useMutation({
    mutationFn: async (newBallot: Partial<Ballot>) => {
      const res = await apiRequest("POST", "/api/ballots", {
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

  const toggleVote = (field: keyof Omit<Ballot, "id" | "nomineeId">) => {
    if (!ballot) return;
    mutation.mutate({ [field]: !ballot[field] });
  };

  if (!ballot) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={ballot.hasWatched ? "default" : "outline"}
        size="sm"
        onClick={() => toggleVote("hasWatched")}
      >
        {ballot.hasWatched ? "Watched" : "Not Watched"}
      </Button>
      <Button
        variant={ballot.predictedWinner ? "default" : "outline"}
        size="sm"
        onClick={() => toggleVote("predictedWinner")}
      >
        {ballot.predictedWinner ? "Predicted Winner" : "Predict Winner"}
      </Button>
      <Button
        variant={ballot.wantToWin ? "default" : "outline"}
        size="sm"
        onClick={() => toggleVote("wantToWin")}
      >
        {ballot.wantToWin ? "Want to Win" : "Pick to Win"}
      </Button>
    </div>
  );
}
