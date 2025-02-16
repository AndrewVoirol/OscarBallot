import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { Home, Film, User } from "lucide-react";

interface NavBarProps {
  selectedYear?: number;
  onYearChange?: (year: number) => void;
}

export function NavBar({ selectedYear = 2025, onYearChange }: NavBarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold sm:inline-block">
              Awards Insider
            </span>
          </Link>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href="/">
                  <NavigationMenuLink
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "gap-2",
                      location === "/" && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {user && (
                <NavigationMenuItem>
                  <Link href="/watchlist">
                    <NavigationMenuLink
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "gap-2",
                        location === "/watchlist" && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Film className="h-4 w-4" />
                      <span>My Watchlist</span>
                    </NavigationMenuLink>
                  </Link>
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
              <Link href="/watchlist" className="md:hidden">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={cn(
                    location === "/watchlist" && "bg-accent text-accent-foreground"
                  )}
                >
                  <Film className="h-4 w-4" />
                  <span className="sr-only">My Watchlist</span>
                </Button>
              </Link>
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
              <Link href="/auth">
                <Button variant="outline" size="sm">Login</Button>
              </Link>
              <Link href="/auth?register=true">
                <Button variant="default" size="sm">Register</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}