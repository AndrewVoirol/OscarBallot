import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AwardsHistory } from "./awards-history";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Calendar, Star, Building2, User } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import type { Nominee } from "@shared/schema";
import { ValidationReport } from "./validation-report";
import { useQuery } from "@tanstack/react-query";

interface NomineeDetailsProps {
  nominee: Nominee;
}

export function NomineeDetails({ nominee }: NomineeDetailsProps) {
  const { data: validationReport, status } = useQuery({
    queryKey: ["/api/nominees/validation", nominee.id],
    queryFn: async () => {
      const response = await fetch(`/api/nominees/${nominee.id}/validation`);
      if (!response.ok) throw new Error("Failed to fetch validation report");
      return response.json();
    },
  });

  return (
    <div className="relative">
      {nominee.backdropPath && (
        <div className="relative h-64 md:h-80">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-10" />
          <img
            src={nominee.backdropPath}
            alt={`${nominee.name} backdrop`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      <div className="relative z-20 p-6 -mt-16">
        <DialogTitle className="sr-only">Details for {nominee.name}</DialogTitle>
<DialogDescription className="sr-only">
  Detailed information about {nominee.name} including awards history, cast, and crew
</DialogDescription>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 w-40 md:w-48">
            <div className="aspect-[2/3] relative bg-muted rounded-lg overflow-hidden shadow-lg">
              <img
                src={nominee.poster}
                alt={nominee.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-primary mb-2">{nominee.name}</h2>
            <p className="text-muted-foreground mb-6">
              {nominee.description || nominee.overview}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {nominee.runtime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    {Math.floor(nominee.runtime / 60)}h {nominee.runtime % 60}min
                  </span>
                </div>
              )}
              {nominee.releaseDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    {new Date(nominee.releaseDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {nominee.voteAverage && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm">{(nominee.voteAverage / 10).toFixed(1)}/10</span>
                </div>
              )}
            </div>

            {nominee.genres && nominee.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {nominee.genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {nominee.streamingPlatforms && nominee.streamingPlatforms.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Where to Watch</h3>
                <div className="flex flex-wrap gap-2">
                  {nominee.streamingPlatforms.map((platform) => (
                    <Badge key={platform} variant="outline">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {nominee.trailerUrl && (
          <div className="aspect-video w-full mt-6 rounded-lg overflow-hidden bg-muted">
            <iframe
              src={nominee.trailerUrl.replace('watch?v=', 'embed/')}
              title={`${nominee.name} Trailer`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <AwardsHistory nominee={nominee} />

        {nominee.extendedCredits && (
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="cast">
              <AccordionTrigger>Cast</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {nominee.extendedCredits.cast.slice(0, 12).map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar className="h-14 w-14 rounded-full overflow-hidden border-2 border-muted">
                        {member.profileImage ? (
                          <AvatarImage
                            src={member.profileImage}
                            alt={member.name}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <AvatarFallback className="bg-muted">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.character || member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="crew">
              <AccordionTrigger>Crew</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {nominee.extendedCredits.crew
                    .filter((member) =>
                      ["Director", "Producer", "Writer", "Director of Photography"].includes(member.job)
                    )
                    .map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar className="h-14 w-14 rounded-full overflow-hidden border-2 border-muted">
                          {member.profileImage ? (
                            <AvatarImage
                              src={member.profileImage}
                              alt={member.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <AvatarFallback className="bg-muted">
                              <User className="h-6 w-6 text-muted-foreground" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.job}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {nominee.productionCompanies && nominee.productionCompanies.length > 0 && (
              <AccordionItem value="production">
                <AccordionTrigger>Production Companies</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-6">
                    {nominee.productionCompanies.map((company) => (
                      <div key={company.id} className="flex items-center gap-3">
                        {company.logoPath ? (
                          <div className="h-12 w-24 relative bg-white/5 rounded-lg p-2 flex items-center justify-center">
                            <img
                              src={company.logoPath}
                              alt={company.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm truncate">{company.name}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}

        {nominee.funFacts && nominee.funFacts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Fun Facts</h3>
            <ul className="space-y-2">
              {nominee.funFacts.map((fact, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  • {fact}
                </li>
              ))}
            </ul>
          </div>
        )}
        {validationReport && <ValidationReport report={validationReport} />}

      </div>
    </div>
  );
}