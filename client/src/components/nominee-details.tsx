import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AwardsHistory } from "./awards-history";
import type { Nominee } from "@shared/schema";

interface NomineeDetailsProps {
  nominee: Nominee;
}

export function NomineeDetails({ nominee }: NomineeDetailsProps) {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-primary mb-4">{nominee.name}</h2>
      <p className="text-muted-foreground mb-6">{nominee.description}</p>

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