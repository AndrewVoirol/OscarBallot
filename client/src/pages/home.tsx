import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CategorySection } from "@/components/category-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavBar } from "@/components/nav-bar";
import { CategoryNav } from "@/components/category-nav";
import { ScrollProgress } from "@/components/scroll-progress";
import type { Nominee } from "@shared/schema";

export default function Home() {
  const { data: nominees, isLoading } = useQuery<Nominee[]>({
    queryKey: ["/api/nominees"],
  });

  const [activeCategory, setActiveCategory] = useState<string>("");
  const categorySectionRefs = useRef<{ [key: string]: HTMLElement }>({});
  const scrolling = useRef(false);

  const categories = Array.from(new Set(nominees?.map((n) => n.category) || []));

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    const observers = new Map();

    categories.forEach((category) => {
      const element = categorySectionRefs.current[category];
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !scrolling.current) {
                setActiveCategory(category);
              }
            });
          },
          { threshold: 0.3 }
        );

        observer.observe(element);
        observers.set(category, observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [categories]);

  const scrollToCategory = (category: string) => {
    const element = categorySectionRefs.current[category];
    if (element) {
      scrolling.current = true;
      const headerOffset = 120; // Account for NavBar + CategoryNav height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      // Reset scrolling flag after animation
      setTimeout(() => {
        scrolling.current = false;
      }, 1000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary animate-pulse text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <NavBar />
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={scrollToCategory}
      />
      <main className="container mx-auto px-4 py-8 mt-[56px]">
        <header className="py-8 px-4 text-center bg-gradient-to-b from-primary/20 to-background">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Oscar Nominees 2024
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track your picks and predictions for this year's Academy Awards
          </p>
        </header>

        <ScrollArea className="h-[calc(100vh-280px)]">
          {categories.map((category) => (
            <div
              key={category}
              ref={(el) => {
                if (el) categorySectionRefs.current[category] = el;
              }}
            >
              <CategorySection
                category={category}
                nominees={nominees?.filter((n) => n.category === category) || []}
              />
            </div>
          ))}
        </ScrollArea>
      </main>
    </div>
  );
}