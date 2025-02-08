import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useMemo } from "react";
import { CategorySection } from "@/components/category-section";
import { NavBar } from "@/components/nav-bar";
import { CategoryNav } from "@/components/category-nav";
import { ScrollProgress } from "@/components/scroll-progress";
import type { Nominee } from "@shared/schema";
import { FilmIcon, AlertCircle, Vote, Save } from "lucide-react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function Home() {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const { user } = useAuth();
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
  const lastScrollTime = useRef<number>(0);

  // Ensure categories are sorted in a specific order (major categories first)
  const sortedCategories = useMemo(() => {
    const categoryOrder = [
      "Best Picture",
      "Best Director",
      "Best Actor",
      "Best Actress",
      "Best Supporting Actor",
      "Best Supporting Actress",
      "Best Original Screenplay",
      "Best Adapted Screenplay",
      "Best Animated Feature",
      "Best International Feature",
      "Best Documentary Feature",
    ];

    const categories = Array.from(new Set(nominees?.map((n) => n.category) || []));
    return categories.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [nominees]);

  useEffect(() => {
    if (sortedCategories.length > 0 && !activeCategory) {
      setActiveCategory(sortedCategories[0]);
    }
  }, [sortedCategories, activeCategory]);

  useEffect(() => {
    const observers = new Map();
    const headerOffset = 120; // Adjusted back to original value

    sortedCategories.forEach((category) => {
      const element = categorySectionRefs.current[category];
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !scrolling.current) {
                const now = Date.now();
                if (now - lastScrollTime.current > 100) { // Reduced debounce time
                  const elementTop = entry.boundingClientRect.top;
                  const elementHeight = entry.boundingClientRect.height;
                  const windowHeight = window.innerHeight;

                  // More precise visibility calculation
                  if (elementTop < windowHeight * 0.4 && elementTop > -elementHeight * 0.6) {
                    setActiveCategory(category);
                    lastScrollTime.current = now;
                  }
                }
              }
            });
          },
          {
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5], // More granular thresholds
            rootMargin: `-${headerOffset}px 0px -10% 0px` // Adjusted margins for better triggering
          }
        );

        observer.observe(element);
        observers.set(category, observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [sortedCategories]);

  const scrollToCategory = (category: string) => {
    const element = categorySectionRefs.current[category];
    if (element) {
      scrolling.current = true;
      const headerOffset = 120;

      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.scrollY;
      const scrollPosition = absoluteElementTop - headerOffset;

      window.scrollTo({
        top: scrollPosition,
        behavior: "smooth"
      });

      // Update the active category immediately for better UX
      setActiveCategory(category);
      lastScrollTime.current = Date.now();

      setTimeout(() => {
        scrolling.current = false;
      }, 800); // Reduced timeout for more responsive navigation
    }
  };

  const getAwardsInfo = (year: number) => {
    if (year === 2025) {
      return {
        title: "The 97th Academy Awards",
        subtitle: "Submit your predictions for the upcoming ceremony on March 10, 2025"
      };
    }
    return {
      title: "The 96th Academy Awards",
      subtitle: "Browse nominees and winners from March 10, 2024"
    };
  };

  const awardsInfo = getAwardsInfo(selectedYear);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <NavBar selectedYear={selectedYear} onYearChange={setSelectedYear} />
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
      <div className="min-h-screen bg-background">
        <NavBar selectedYear={selectedYear} onYearChange={setSelectedYear} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading nominees...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <NavBar selectedYear={selectedYear} onYearChange={setSelectedYear} />
      <CategoryNav
        categories={sortedCategories}
        activeCategory={activeCategory}
        onSelectCategory={scrollToCategory}
      />
      {isRefreshing && (
        <div className="fixed top-14 left-0 w-full flex justify-center py-2 bg-background/95 backdrop-blur z-50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <main className="container mx-auto px-4 mt-6">
        {selectedYear === 2025 && !user && (
          <Alert className="mb-6">
            <Vote className="h-4 w-4" />
            <AlertTitle>Submit Your Oscar Predictions!</AlertTitle>
            <AlertDescription>
              <Link href="/auth" className="underline text-primary">
                Sign in or register
              </Link>{" "}
              to save your predictions for the 97th Academy Awards.
            </AlertDescription>
          </Alert>
        )}

        {selectedYear === 2025 && user && (
          <Alert className="mb-6 border-primary/50">
            <Save className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Your Ballot is Auto-Saving!</AlertTitle>
            <AlertDescription>
              Your predictions are automatically saved as you vote. Use the buttons below each nominee to track what you've watched and predict winners.
            </AlertDescription>
          </Alert>
        )}

        <header className="py-3 mb-4 text-center bg-gradient-to-b from-primary/20 to-background rounded-lg">
          <div className="flex items-center justify-center gap-2">
            <FilmIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              {awardsInfo.title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {awardsInfo.subtitle}
          </p>
          {selectedYear === 2025 && user && (
            <p className="text-sm text-primary mt-2">
              Vote for your predictions below to save your ballot
            </p>
          )}
        </header>

        {sortedCategories.map((category) => (
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