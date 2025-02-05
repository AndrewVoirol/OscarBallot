import { NomineeCard } from "./nominee-card";
import type { Nominee } from "@shared/schema";

interface CategorySectionProps {
  category: string;
  nominees: Nominee[];
}

export function CategorySection({ category, nominees }: CategorySectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-primary">{category}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nominees.map((nominee) => (
          <NomineeCard key={nominee.id} nominee={nominee} />
        ))}
      </div>
    </section>
  );
}