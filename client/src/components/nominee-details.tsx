import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AwardsHistory } from "./awards-history";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Calendar, Star, Building2, User, LightbulbIcon } from "lucide-react";
import type { Nominee } from "@shared/schema";

interface NomineeDetailsProps {
  nominee: Nominee;
}

export function NomineeDetails({ nominee }: NomineeDetailsProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return undefined;
    // Ensure path starts with '/' for TMDB API
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://image.tmdb.org/t/p/w500${cleanPath}`;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Image failed to load:', e.currentTarget.src);
    e.currentTarget.style.display = 'none';
  };

  return (
    <div className="relative">
      {nominee.backdropPath && (
        <div className="relative h-64 md:h-80">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-10" />
          <img
            src={getImageUrl(nominee.backdropPath)}
            alt={`${nominee.name} backdrop`}
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleImageError}
          />
        </div>
      )}

      <div className="relative z-20 p-6 -mt-16">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 w-40 md:w-48">
            <div className="aspect-[2/3] relative bg-muted rounded-lg overflow-hidden shadow-lg">
              <img
                src={nominee.poster}
                alt={nominee.name}
                className="absolute inset-0 w-full h-full object-cover"
                onError={handleImageError}
              />
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-primary mb-4">{nominee.name}</h2>

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
                  <span className="text-sm">{formatDate(nominee.releaseDate)}</span>
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
                {nominee.genres.map((genre, index) => (
                  <Badge key={`${nominee.id}-genre-${index}`} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {nominee.streamingPlatforms && nominee.streamingPlatforms.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Where to Watch</h3>
                <div className="flex flex-wrap gap-2">
                  {nominee.streamingPlatforms.map((platform, index) => (
                    <Badge key={`${nominee.id}-platform-${index}`} variant="outline">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-muted-foreground mb-6">{nominee.description}</p>

            {nominee.trailerUrl && (
              <div className="aspect-video w-full mb-6 rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={nominee.trailerUrl}
                  title={`${nominee.name} Trailer`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            <AwardsHistory nominee={nominee} />

            <Accordion type="single" collapsible className="mt-6">
              {/* Cast Section */}
              {nominee.extendedCredits?.cast && nominee.extendedCredits.cast.length > 0 && (
                <AccordionItem value="cast">
                  <AccordionTrigger>
                    Cast ({nominee.extendedCredits.cast.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {nominee.extendedCredits.cast.slice(0, 12).map((member) => (
                        <div key={`${nominee.id}-cast-${member.id}`} className="flex items-center gap-3">
                          <Avatar className="h-14 w-14">
                            {member.profile_path && (
                              <AvatarImage
                                src={getImageUrl(member.profile_path)}
                                alt={member.name}
                                onError={handleImageError}
                              />
                            )}
                            <AvatarFallback>
                              <User className="h-6 w-6 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.character}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Crew Section */}
              {nominee.extendedCredits?.crew && nominee.extendedCredits.crew.length > 0 && (
                <AccordionItem value="crew">
                  <AccordionTrigger>
                    Crew ({nominee.extendedCredits.crew.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {nominee.extendedCredits.crew
                        .filter((member) =>
                          ["Director", "Producer", "Writer", "Director of Photography"].includes(member.job)
                        )
                        .map((member) => (
                          <div key={`${nominee.id}-crew-${member.id}-${member.job}`} className="flex items-center gap-3">
                            <Avatar className="h-14 w-14">
                              {member.profile_path && (
                                <AvatarImage
                                  src={getImageUrl(member.profile_path)}
                                  alt={member.name}
                                  onError={handleImageError}
                                />
                              )}
                              <AvatarFallback>
                                <User className="h-6 w-6 text-muted-foreground" />
                              </AvatarFallback>
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
              )}

              {/* Fun Facts Section */}
              {nominee.funFacts && nominee.funFacts.length > 0 && (
                <AccordionItem value="funFacts">
                  <AccordionTrigger className="flex items-center gap-2">
                    <LightbulbIcon className="h-4 w-4" />
                    Fun Facts
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2">
                      {nominee.funFacts.map((fact, index) => (
                        <li key={`${nominee.id}-fact-${index}`} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Production Companies Section */}
              {nominee.productionCompanies && nominee.productionCompanies.length > 0 && (
                <AccordionItem value="production">
                  <AccordionTrigger>Production Companies</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-6">
                      {nominee.productionCompanies.map((company) => (
                        <div key={`${nominee.id}-company-${company.id}`} className="flex items-center gap-3">
                          {company.logo_path ? (
                            <div className="h-12 w-24 relative bg-white/5 rounded-lg p-2 flex items-center justify-center">
                              <img
                                src={getImageUrl(company.logo_path)}
                                alt={company.name}
                                className="max-h-full max-w-full object-contain"
                                onError={handleImageError}
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
          </div>
        </div>
      </div>
    </div>
  );
}