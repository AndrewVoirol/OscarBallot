import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface AwardsBadgeProps {
  awards: Record<string, boolean>;
}

export function AwardsBadge({ awards }: AwardsBadgeProps) {
  const awardCount = Object.values(awards).filter(Boolean).length;
  
  if (awardCount === 0) return null;

  return (
    <Badge
      className="absolute top-2 right-2 bg-primary text-primary-foreground flex items-center gap-1"
    >
      <Trophy className="w-4 h-4" />
      {awardCount} {awardCount === 1 ? 'Award' : 'Awards'}
    </Badge>
  );
}
