import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { type Ballot, type Nominee } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NomineeDetails } from "@/components/nominee-details";
import { NavBar } from "@/components/nav-bar";
import { useState } from "react";

export default function WatchlistPage() {
  const { user } = useAuth();
  const [selectedNominee, setSelectedNominee] = useState<Nominee | null>(null);

  const { data: nominees } = useQuery<Nominee[]>({
    queryKey: ["/api/nominees"],
  });

  const { data: ballots } = useQuery<Ballot[]>({
    queryKey: ["/api/ballots"],
    enabled: !!user,
  });

  if (!nominees || !ballots) {
    return (
      <>
        <NavBar />
        <div className="container py-8">
          <div className="h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading watchlist...</p>
          </div>
        </div>
      </>
    );
  }

  const watchedNominees = nominees.filter((nominee) =>
    ballots.some(
      (ballot) => ballot.nomineeId === nominee.id && ballot.hasWatched
    )
  );

  const unwatchedNominees = nominees.filter((nominee) =>
    ballots.some(
      (ballot) => ballot.nomineeId === nominee.id && !ballot.hasWatched
    )
  );

  return (
    <>
      <NavBar />
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">My Watchlist</h1>

        <Tabs defaultValue="watched" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="watched">
              Watched ({watchedNominees.length})
            </TabsTrigger>
            <TabsTrigger value="watchlist">
              To Watch ({unwatchedNominees.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="watched">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchedNominees.map((nominee) => (
                <button
                  key={nominee.id}
                  onClick={() => setSelectedNominee(nominee)}
                  className="text-left w-full"
                  aria-label={`View details for ${nominee.name}`}
                >
                  <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 shrink-0">
                          <div className="aspect-[2/3] relative bg-muted rounded-lg overflow-hidden">
                            <img
                              src={nominee.poster}
                              alt={nominee.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1 line-clamp-2">{nominee.name}</h3>
                          <Badge variant="secondary" className="mb-2">
                            {nominee.category}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Watched</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="watchlist">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unwatchedNominees.map((nominee) => (
                <button
                  key={nominee.id}
                  onClick={() => setSelectedNominee(nominee)}
                  className="text-left w-full"
                  aria-label={`View details for ${nominee.name}`}
                >
                  <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 shrink-0">
                          <div className="aspect-[2/3] relative bg-muted rounded-lg overflow-hidden">
                            <img
                              src={nominee.poster}
                              alt={nominee.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1 line-clamp-2">{nominee.name}</h3>
                          <Badge variant="secondary" className="mb-2">
                            {nominee.category}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Want to watch</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedNominee} onOpenChange={() => setSelectedNominee(null)}>
          <DialogContent 
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <DialogTitle className="sr-only">
              {selectedNominee?.name}
            </DialogTitle>
            {selectedNominee && (
              <NomineeDetails nominee={selectedNominee} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}