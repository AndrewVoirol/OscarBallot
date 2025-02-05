import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { AwardsHistory } from "./awards-history";
import type { Nominee } from "@shared/schema";

interface NomineeDetailsProps {
  nominee: Nominee;
  onClose: () => void;
}

export function NomineeDetails({ nominee, onClose }: NomineeDetailsProps) {
  return (
    <div className="relative p-4">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-4 px-4">
        <h2 className="text-2xl font-bold text-primary">{nominee.name}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={onClose}
          aria-label="Close details"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">{nominee.description}</p>

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

      <Accordion type="single" collapsible className="mt-6">
        <AccordionItem value="cast">
          <AccordionTrigger>Cast</AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc ml-6">
              {nominee.cast.map((member, i) => (
                <li key={i}>{member}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="crew">
          <AccordionTrigger>Crew</AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc ml-6">
              {nominee.crew.map((member, i) => (
                <li key={i}>{member}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="facts">
          <AccordionTrigger>Fun Facts</AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc ml-6">
              {nominee.funFacts.map((fact, i) => (
                <li key={i}>{fact}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}