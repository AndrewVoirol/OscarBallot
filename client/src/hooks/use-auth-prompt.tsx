import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useAuthPrompt() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const promptAuth = (feature: "watchlist" | "voting", onContinueAsGuest?: () => void) => {
    const messages = {
      watchlist: {
        title: "Want to save your watchlist?",
        description: "Login or register to keep track of nominees you want to watch later.",
      },
      voting: {
        title: "Want to save your predictions?",
        description: "Login or register to save your Oscar predictions permanently.",
      },
    };

    toast({
      title: messages[feature].title,
      description: messages[feature].description,
      action: (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              setLocation("/auth");
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3"
          >
            Login/Register
          </button>
          <button
            onClick={() => {
              onContinueAsGuest?.();
            }}
            className="border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3"
          >
            Continue as Guest
          </button>
        </div>
      ),
      duration: 5000,
    });
  };

  return {
    promptAuth,
  };
}
