import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { Home, Film, User } from "lucide-react";

interface NavBarProps {
  selectedYear?: number;
  onYearChange?: (year: number) => void;
}

export function NavBar({ selectedYear = 2025, onYearChange }: NavBarProps) {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Button
            variant="link"
            className="font-bold px-0 sm:inline-block"
            onClick={() => navigate("/")}
          >
            Awards Insider
          </Button>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2",
                    location === "/" && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => navigate("/")}
                >
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Button>
              </NavigationMenuItem>

              {user && (
                <NavigationMenuItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2",
                      location === "/watchlist" && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => navigate("/watchlist")}
                  >
                    <Film className="h-4 w-4" />
                    <span>My Watchlist</span>
                  </Button>
                </NavigationMenuItem>
              )}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-4">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => onYearChange?.(parseInt(value))}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>

          {user ? (
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "md:hidden",
                  location === "/watchlist" && "bg-accent text-accent-foreground"
                )}
                onClick={() => navigate("/watchlist")}
              >
                <Film className="h-4 w-4" />
                <span className="sr-only">My Watchlist</span>
              </Button>
              <div className="hidden md:flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  {user.username}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                size="sm"
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/auth")}
              >
                Login
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate("/auth?register=true")}
              >
                Register
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}