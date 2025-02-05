import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface CategoryNavProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryNav({
  categories,
  activeCategory,
  onSelectCategory,
}: CategoryNavProps) {
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeButton = buttonRefs.current[activeCategory];
    const container = scrollContainerRef.current;

    if (activeButton && container) {
      const containerWidth = container.offsetWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;

      // Calculate the scroll position that centers the active button
      const targetScroll = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);

      // Apply the scroll with smooth behavior
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth"
      });
    }
  }, [activeCategory]);

  return (
    <div className="sticky top-14 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div 
        ref={scrollContainerRef}
        className="w-full overflow-x-auto scrollbar-hide"
      >
        <div className="flex w-max min-w-full px-4 py-2 transition-transform duration-300 ease-out">
          <div className="flex space-x-2 mx-auto">
            {categories.map((category) => (
              <Button
                key={category}
                ref={(el) => (buttonRefs.current[category] = el)}
                variant="ghost"
                size="sm"
                onClick={() => onSelectCategory(category)}
                className={cn(
                  "transition-all duration-300 ease-in-out px-4",
                  activeCategory === category
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "hover:bg-transparent hover:text-primary"
                )}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}