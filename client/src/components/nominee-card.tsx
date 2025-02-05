import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { VotingControls } from "./voting-controls";
import { NomineeDetails } from "./nominee-details";
import { AwardsBadge } from "./awards-badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { Nominee } from "@shared/schema";

interface NomineeCardProps {
  nominee: Nominee;
  isLoading?: boolean;
  isHistorical?: boolean;
}

export function NomineeCard({ nominee, isLoading, isHistorical }: NomineeCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="p-0">
          <Skeleton className="w-full h-56 sm:h-48" />
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="h-6 w-3/4 mb-3" />
          <div className="flex gap-2 mb-6">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="relative p-0">
        <img
          src={nominee.poster}
          alt={nominee.name}
          className="w-full h-56 sm:h-48 object-cover"
          loading="lazy"
        />
        {isHistorical && nominee.isWinner && (
          <div className="absolute top-2 right-2">
            <Badge variant="default" className="gap-1">
              <Trophy className="h-4 w-4" />
              Winner
            </Badge>
          </div>
        )}
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
        <VotingControls nomineeId={nominee.id} isHistorical={isHistorical} />
        <button
          onClick={() => setIsOpen(true)}
          className="text-base sm:text-sm text-primary hover:underline mt-6 sm:mt-4 w-full text-left py-2 sm:py-1"
          aria-label={`View details for ${nominee.name}`}
        >
          View Details
        </button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <NomineeDetails nominee={nominee} />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}