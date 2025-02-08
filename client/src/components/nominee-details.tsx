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
import type { Nominee } from "@shared/schema";

interface NomineeDetailsProps {
  nominee: Nominee;
}

export function NomineeDetails({ nominee }: NomineeDetailsProps) {
  return (
    <div className="relative">
      {nominee.backdrop_path && (
        <div className="relative h-64 md:h-80">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-10" />
          <img
            src={nominee.backdrop_path}
            alt={`${nominee.name} backdrop`}
            className="absolute inset-0 w-full h-full object-cover"
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
              />
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-primary mb-2">{nominee.name}</h2>
            <p className="text-muted-foreground mb-6">{nominee.description}</p>

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

            {nominee.streamingPlatforms.length > 0 && (
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
              src={nominee.trailerUrl}
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
                      <Avatar className="h-12 w-12">
                        {member.profileImage ? (
                          <AvatarImage
                            src={member.profileImage}
                            alt={member.name}
                          />
                        ) : (
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{member.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {member.character}
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
                        <Avatar className="h-12 w-12">
                          {member.profileImage ? (
                            <AvatarImage
                              src={member.profileImage}
                              alt={member.name}
                            />
                          ) : (
                            <AvatarFallback>
                              <User className="h-6 w-6" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium line-clamp-1">{member.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{member.job}</p>
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
                  <div className="grid grid-cols-2 gap-4">
                    {nominee.productionCompanies.map((company) => (
                      <div key={company.id} className="flex items-center gap-3">
                        {company.logoPath ? (
                          <img
                            src={company.logoPath}
                            alt={company.name}
                            className="h-8 object-contain"
                          />
                        ) : (
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        )}
                        <span className="text-sm">{company.name}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>
    </div>
  );
}