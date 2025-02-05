import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { Nominee } from "@shared/schema";

interface AwardsHistoryProps {
  nominee: Nominee;
}

export function AwardsHistory({ nominee }: AwardsHistoryProps) {
  if (!nominee.historicalAwards?.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        Awards History
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Award</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nominee.historicalAwards.flatMap((yearData) =>
            yearData.awards.map((award, index) => (
              <TableRow key={`${yearData.year}-${index}`}>
                <TableCell>{yearData.year}</TableCell>
                <TableCell>{award.name}</TableCell>
                <TableCell>{award.type}</TableCell>
                <TableCell>
                  <Badge
                    variant={award.result === "Won" ? "default" : "secondary"}
                    className="font-medium"
                  >
                    {award.result}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
