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
}

export function AuthPromptDialog({
  open,
  onOpenChange,
  feature,
}: AuthPromptDialogProps) {
  const [, setLocation] = useLocation();

  const messages = {
    watchlist: {
      title: "Save Your Watchlist",
      description: "Create an account to keep track of nominees you want to watch later.",
    },
    voting: {
      title: "Save Your Oscar Predictions",
      description: "Create an account to save your predictions and see how they match up with the winners!",
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages[feature].title}</DialogTitle>
          <DialogDescription className="pt-2">
            {messages[feature].description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false); // Just close dialog, no redirect
            }}
          >
            Continue Browsing as Guest
          </Button>
          <div className="flex gap-2">
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

  const promptAuth = (featureType: "watchlist" | "voting") => {
    setFeature(featureType);
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
      />
    ),
  };
}