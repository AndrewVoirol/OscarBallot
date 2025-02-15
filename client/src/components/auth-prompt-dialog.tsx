import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuthPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: "watchlist" | "voting";
  onContinueAsGuest?: () => void;
}

export function AuthPromptDialog({
  open,
  onOpenChange,
  feature,
  onContinueAsGuest,
}: AuthPromptDialogProps) {
  const [, setLocation] = useLocation();

  const messages = {
    watchlist: {
      title: "Want to Save Your Watchlist?",
      description: "Create an account to keep track of nominees you want to watch later. Or continue browsing as a guest.",
      guestNote: "Note: As a guest, your watchlist will only be saved for this session.",
    },
    voting: {
      title: "Want to Save Your Oscar Predictions?",
      description: "Create an account to save your predictions and see how they match up with the winners! Or continue browsing as a guest.",
      guestNote: "Note: As a guest, your predictions will only be saved for this session.",
    },
  };

  const handleContinueAsGuest = () => {
    onOpenChange(false);
    onContinueAsGuest?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages[feature].title}</DialogTitle>
          <DialogDescription className="pt-2 space-y-2">
            <p>{messages[feature].description}</p>
            <p className="text-sm text-muted-foreground italic">
              {messages[feature].guestNote}
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-4 sm:gap-2">
          <Button
            variant="default"
            onClick={handleContinueAsGuest}
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            Continue as Guest
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setLocation("/auth");
              }}
            >
              Login
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                setLocation("/auth?register=true");
              }}
            >
              Register
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useAuthPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<"watchlist" | "voting">("watchlist");
  const [onContinueAsGuest, setOnContinueAsGuest] = useState<(() => void) | undefined>(undefined);

  const promptAuth = (featureType: "watchlist" | "voting", onContinue?: () => void) => {
    setFeature(featureType);
    setOnContinueAsGuest(() => onContinue);
    setIsOpen(true);
  };

  return {
    isDialogOpen: isOpen,
    setDialogOpen: setIsOpen,
    selectedFeature: feature,
    promptAuth,
    AuthPromptDialog: () => (
      <AuthPromptDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        feature={feature}
        onContinueAsGuest={onContinueAsGuest}
      />
    ),
  };
}