
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ValidationReportProps {
  report: {
    mediaScore: number;
    dataCompleteness: number;
    issues: string[];
    recommendations: string[];
  };
}

export function ValidationReport({ report }: ValidationReportProps) {
  const totalScore = (report.mediaScore + report.dataCompleteness) / 2;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {totalScore >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : totalScore >= 50 ? (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            Validation Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Media Score</span>
                <Badge variant={report.mediaScore >= 80 ? "default" : "secondary"}>
                  {report.mediaScore}%
                </Badge>
              </div>
              <Progress value={report.mediaScore} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Data Completeness</span>
                <Badge
                  variant={report.dataCompleteness >= 80 ? "default" : "secondary"}
                >
                  {report.dataCompleteness}%
                </Badge>
              </div>
              <Progress value={report.dataCompleteness} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {report.issues.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Issues Found</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {report.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {report.recommendations.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {report.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
