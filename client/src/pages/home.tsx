import { useQuery } from "@tanstack/react-query";
import { CategorySection } from "@/components/category-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavBar } from "@/components/nav-bar"; // Added import for NavBar
import type { Nominee } from "@shared/schema";

export default function Home() {
  const { data: nominees, isLoading } = useQuery<Nominee[]>({
    queryKey: ["/api/nominees"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse text-2xl">Loading...</div>
      </div>
    );
  }

  const categories = [...new Set(nominees?.map((n) => n.category))];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <header className="py-8 px-4 text-center bg-gradient-to-b from-primary/20 to-background">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          Oscar Nominees 2024
        </h1>
        <p className="mt-2 text-muted-foreground">
          Track your picks and predictions for this year's Academy Awards
        </p>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ScrollArea className="h-[calc(100vh-200px)]">
          {categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              nominees={nominees?.filter((n) => n.category === category) || []}
            />
          ))}
        </ScrollArea>
      </main>
    </div>
  );
}