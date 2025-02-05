import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AwardsHistory } from "./awards-history";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Nominee } from "@shared/schema";
import { Clock, Calendar, Star, Building2 } from "lucide-react";

interface NomineeDetailsProps {
  nominee: Nominee;
}

export function NomineeDetails({ nominee }: NomineeDetailsProps) {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-primary mb-4">{nominee.name}</h2>
      <p className="text-muted-foreground mb-6">{nominee.description}</p>

      {nominee.backdropPath && (
        <img
          src={`https://image.tmdb.org/t/p/original${nominee.backdropPath}`}
          alt={`${nominee.name} backdrop`}
          className="w-full h-48 object-cover rounded-lg mb-6"
        />
      )}

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
        {nominee.genres && nominee.genres.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {nominee.genres.map((genre) => (
                <Badge key={genre} variant="secondary" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

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

      <div className="aspect-video w-full mb-6">
        <iframe
          src={nominee.trailerUrl}
          title={`${nominee.name} Trailer`}
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <AwardsHistory nominee={nominee} />

      {nominee.extendedCredits && (
        <Accordion type="single" collapsible className="mt-6">
          <AccordionItem value="cast">
            <AccordionTrigger>Cast</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {nominee.extendedCredits.cast.slice(0, 10).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    {member.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w45${member.profile_path}`}
                        alt={member.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {member.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
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
              <div className="space-y-4">
                {nominee.extendedCredits.crew
                  .filter((member) =>
                    ["Director", "Producer", "Writer", "Director of Photography"].includes(member.job)
                  )
                  .map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      {member.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w45${member.profile_path}`}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {member.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.job}</p>
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
                      {company.logo_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w45${company.logo_path}`}
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
  );
}