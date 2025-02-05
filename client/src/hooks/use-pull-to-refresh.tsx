import { useEffect, useState } from "react";
import { queryClient } from "@/lib/queryClient";

export function usePullToRefresh() {
  const [startY, setStartY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const threshold = 150; // pixels to pull down before refreshing

  useEffect(() => {
    let pulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only enable pull to refresh at the top of the page
      if (window.scrollY === 0) {
        pulling = true;
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && diff < threshold) {
        // Apply resistance to the pull
        document.body.style.transform = `translateY(${diff * 0.3}px)`;
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling) return;
      pulling = false;

      document.body.style.transform = "";
      const diff = parseFloat(document.body.style.transform.replace("translateY(", ""));

      if (diff >= threshold) {
        setRefreshing(true);
        // Invalidate all queries to refresh data
        await queryClient.invalidateQueries();
        setRefreshing(false);
      }
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [startY]);

  return refreshing;
}
