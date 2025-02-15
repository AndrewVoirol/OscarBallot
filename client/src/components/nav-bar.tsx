import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthPrompt } from "@/hooks/use-auth-prompt";

interface NavBarProps {
  selectedYear?: number;
  onYearChange?: (year: number) => void;
}

export function NavBar({ selectedYear = 2025, onYearChange }: NavBarProps) {
  const { user, logoutMutation } = useAuth();
  const { promptAuth } = useAuthPrompt();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold sm:inline-block">
              Awards Insider
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
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
              <span className="text-sm text-muted-foreground">
                Signed in as {user.username}
              </span>
              <Button
                variant="outline"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/auth?register=true">
                <Button variant="default">Register</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}