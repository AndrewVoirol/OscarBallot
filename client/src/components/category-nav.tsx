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

      const targetScroll = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);

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
        className="w-full overflow-x-auto scrollbar-hide py-2 sm:py-1"
      >
        <div className="flex w-max min-w-full px-4 transition-transform duration-300 ease-out">
          <div className="flex space-x-2 sm:space-x-1.5 mx-auto">
            {categories.map((category) => (
              <Button
                key={category}
                ref={(el) => (buttonRefs.current[category] = el)}
                variant="ghost"
                size="sm"
                onClick={() => onSelectCategory(category)}
                className={cn(
                  "transition-all duration-300 ease-in-out min-h-[44px] sm:min-h-[36px] px-4 sm:px-3 py-2 sm:py-1.5 text-base sm:text-sm",
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