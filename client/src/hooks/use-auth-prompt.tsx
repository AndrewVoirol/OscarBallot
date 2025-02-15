import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function useAuthPrompt() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const promptAuth = (feature: "watchlist" | "voting", onContinueAsGuest?: () => void) => {
    const messages = {
      watchlist: {
        title: "Want to save your watchlist?",
        description: "Create an account to keep track of nominees you want to watch later.",
        guestNote: "As a guest, your watchlist will only be saved for this session.",
      },
      voting: {
        title: "Want to save your predictions?",
        description: "Create an account to save your Oscar predictions permanently.",
        guestNote: "As a guest, your predictions will only be saved for this session.",
      },
    };

    const { dismiss } = toast({
      title: messages[feature].title,
      description: (
        <div>
          <p>{messages[feature].description}</p>
          <p className="text-sm text-muted-foreground mt-2">{messages[feature].guestNote}</p>
        </div>
      ),
      duration: 0,
      action: (
        <div className="flex gap-2 mt-2">
          <Button
            onClick={() => {
              dismiss();
              setLocation("/auth?register=true");
            }}
            variant="default"
            size="sm"
          >
            Register
          </Button>
          <Button
            onClick={() => {
              dismiss();
              onContinueAsGuest?.();
            }}
            variant="outline"
            size="sm"
          >
            Skip for now
          </Button>
        </div>
      ),
    });
  };

  return {
    promptAuth,
  };
}