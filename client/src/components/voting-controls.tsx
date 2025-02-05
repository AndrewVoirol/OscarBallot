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
}

export function VotingControls({ nomineeId }: VotingControlsProps) {
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

  const handleAction = (field: keyof Omit<Ballot, "id" | "nomineeId">) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login or register to track your Oscar picks",
        variant: "default",
      });
      setLocation("/auth");
      return;
    }
    if (!ballot) return;
    mutation.mutate({ [field]: !ballot[field] });
  };

  const getButtonProps = (field: keyof Omit<Ballot, "id" | "nomineeId">) => ({
    variant: ballot?.[field] ? "default" : "outline",
    size: "lg" as const,
    className: "h-12 sm:h-9 text-base sm:text-sm w-full justify-center",
    onClick: () => handleAction(field),
  });

  return (
    <div className="flex flex-col gap-3 sm:gap-2">
      <Button
        {...getButtonProps("hasWatched")}
      >
        {ballot?.hasWatched ? "Watched" : "Not Watched"}
      </Button>
      <Button
        {...getButtonProps("predictedWinner")}
      >
        {ballot?.predictedWinner ? "Predicted Winner" : "Predict Winner"}
      </Button>
      <Button
        {...getButtonProps("wantToWin")}
      >
        {ballot?.wantToWin ? "Want to Win" : "Pick to Win"}
      </Button>
    </div>
  );
}