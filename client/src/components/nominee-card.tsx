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
          className="w-full h-48 object-cover"
        />
        <AwardsBadge awards={nominee.awards} />
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-2">{nominee.name}</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {nominee.streamingPlatforms.map((platform) => (
            <span
              key={platform}
              className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary"
            >
              {platform}
            </span>
          ))}
        </div>
        <VotingControls nomineeId={nominee.id} />
        <button
          onClick={() => setIsOpen(true)}
          className="text-sm text-primary hover:underline mt-4 w-full text-left"
        >
          View Details
        </button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <NomineeDetails nominee={nominee} onClose={() => setIsOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}