import { NomineeCard } from "./nominee-card";
import type { Nominee } from "@shared/schema";

interface CategorySectionProps {
  category: string;
  nominees: Nominee[];
  isLoading?: boolean;
}

export function CategorySection({ category, nominees, isLoading }: CategorySectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-primary">{category}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          // Show 3 skeleton cards while loading
          Array.from({ length: 3 }).map((_, i) => (
            <NomineeCard key={i} nominee={{} as Nominee} isLoading={true} />
          ))
        ) : (
          nominees.map((nominee) => (
            <NomineeCard key={nominee.id} nominee={nominee} />
          ))
        )}
      </div>
    </section>
  );
}