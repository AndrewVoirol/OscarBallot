import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CategorySection } from "@/components/category-section";
import { NavBar } from "@/components/nav-bar";
import { CategoryNav } from "@/components/category-nav";
import { ScrollProgress } from "@/components/scroll-progress";
import type { Nominee } from "@shared/schema";
import { FilmIcon, AlertCircle } from "lucide-react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Home() {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const { data: nominees, isLoading, error } = useQuery<Nominee[]>({
    queryKey: ["/api/nominees", selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/nominees?year=${selectedYear}`);
      if (!response.ok) throw new Error("Failed to fetch nominees");
      return response.json();
    },
  });

  const isRefreshing = usePullToRefresh();
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
    const headerOffset = 120;

    categories.forEach((category) => {
      const element = categorySectionRefs.current[category];
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !scrolling.current) {
                const elementTop = entry.boundingClientRect.top;
                const elementHeight = entry.boundingClientRect.height;
                const windowHeight = window.innerHeight;

                if (elementTop < windowHeight / 2 && elementTop > -elementHeight / 2) {
                  setActiveCategory(category);
                }
              }
            });
          },
          {
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: `-${headerOffset}px 0px -20% 0px`
          }
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
      const headerOffset = 120;

      // Get the element's position relative to the document
      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.scrollY;
      const scrollPosition = absoluteElementTop - headerOffset;

      window.scrollTo({
        top: scrollPosition,
        behavior: "smooth",
      });

      // Ensure we set scrolling back to false after animation completes
      setTimeout(() => {
        scrolling.current = false;
      }, 1000);

      setActiveCategory(category);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <NavBar />
        <div className="container mx-auto mt-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load nominees. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

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
      <NavBar selectedYear={selectedYear} onYearChange={setSelectedYear} />
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={scrollToCategory}
      />
      {isRefreshing && (
        <div className="fixed top-14 left-0 w-full flex justify-center py-2 bg-background/95 backdrop-blur z-50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <main className="container mx-auto px-4 mt-6">
        <header className="py-3 mb-4 text-center bg-gradient-to-b from-primary/20 to-background rounded-lg">
          <div className="flex items-center justify-center gap-2">
            <FilmIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              {selectedYear === 2025 ? (
                <>Oscar Nominees {selectedYear}</>
              ) : (
                <>Oscar Winners & Nominees {selectedYear}</>
              )}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedYear === 2025
              ? "Track your picks and predictions for this year's Academy Awards"
              : "Browse past nominees and winners"}
          </p>
        </header>

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
              isHistorical={selectedYear !== 2025}
            />
          </div>
        ))}
      </main>
    </div>
  );
}