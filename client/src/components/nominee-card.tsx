import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { VotingControls } from "./voting-controls";
import { NomineeDetails } from "./nominee-details";
import { AwardsBadge } from "./awards-badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Nominee } from "@shared/schema";

interface NomineeCardProps {
  nominee: Nominee;
}

export function NomineeCard({ nominee }: NomineeCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="relative p-0">
        <img
          src={nominee.poster}
          alt={nominee.name}
          className="w-full h-56 sm:h-48 object-cover"
        />
        <AwardsBadge awards={nominee.awards} />
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <h3 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">{nominee.name}</h3>
        <div className="flex flex-wrap gap-2 mb-6 sm:mb-4">
          {nominee.streamingPlatforms.map((platform) => (
            <span
              key={platform}
              className="text-sm sm:text-xs px-3 py-1.5 sm:py-1 rounded-full bg-primary/20 text-primary"
            >
              {platform}
            </span>
          ))}
        </div>
        <VotingControls nomineeId={nominee.id} />
        <button
          onClick={() => setIsOpen(true)}
          className="text-base sm:text-sm text-primary hover:underline mt-6 sm:mt-4 w-full text-left py-2 sm:py-1"
        >
          View Details
        </button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 border-b">
              <h2 className="text-xl font-semibold">{nominee.name}</h2>
            </div>
            <div className="p-4">
              <NomineeDetails nominee={nominee} />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}