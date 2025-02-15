import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";

interface AuthPromptDialogProps {
  feature: "watchlist" | "voting";
  onContinueAsGuest?: () => void;
}

export function AuthPromptDialog({ feature, onContinueAsGuest }: AuthPromptDialogProps) {
  const [, setLocation] = useLocation();

  const messages = {
    watchlist: {
      title: "Want to Save Your Watchlist?",
      description: "Create an account to keep track of nominees you want to watch later.",
      guestNote: "As a guest, your watchlist will only be saved for this session.",
    },
    voting: {
      title: "Want to Save Your Oscar Predictions?",
      description: "Create an account to save your predictions and see how they match up with the winners!",
      guestNote: "As a guest, your predictions will only be saved for this session.",
    },
  };

  toast({
    title: messages[feature].title,
    description: messages[feature].description,
    duration: 0, // Toast won't auto-dismiss
    action: (
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <ToastAction altText="Register" onClick={() => {
          setLocation("/auth?register=true");
        }}>
          Register
        </ToastAction>
        <Button
          variant="outline"
          onClick={() => {
            onContinueAsGuest?.();
          }}
          className="h-8 px-3"
        >
          Skip for now
        </Button>
      </div>
    ),
  });

  return null;
}

export function useAuthPrompt() {
  const [feature, setFeature] = useState<"watchlist" | "voting">("watchlist");
  const [onContinueAsGuest, setOnContinueAsGuest] = useState<(() => void) | undefined>(undefined);

  const promptAuth = (featureType: "watchlist" | "voting", onContinue?: () => void) => {
    setFeature(featureType);
    setOnContinueAsGuest(() => onContinue);
    return <AuthPromptDialog feature={featureType} onContinueAsGuest={onContinue} />;
  };

  return {
    promptAuth,
  };
}