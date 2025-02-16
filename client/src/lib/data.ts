import { type Nominee } from "@shared/schema";

// We should avoid using mock data now that we have real data from the Oscar database
export const mockNominees: Nominee[] = [
  {
    id: 1,
    name: "Oppenheimer",
    category: "Best Picture",
    description: "Epic biographical thriller about J. Robert Oppenheimer and the development of the atomic bomb.",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
    streamingPlatforms: ["Prime Video", "Apple TV+"],
    awards: {
      "Golden Globe": true,
      "BAFTA": true,
      "Critics Choice": true
    },
    historicalAwards: [{
      year: 2024,
      awards: [{
        ceremonyId: 96,
        name: "Golden Globe",
        type: "Best Motion Picture - Drama",
        result: "Won",
        dateAwarded: "2024-01-07"
      }]
    }],
    castMembers: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."],
    crew: ["Christopher Nolan - Director", "Hoyte van Hoytema - Cinematographer"],
    funFacts: [
      "Shot entirely on IMAX cameras",
      "Used practical effects instead of CGI for nuclear explosion sequences"
    ],
    ceremonyYear: 2024,
    isWinner: true,
    tmdbId: 872585,
    runtime: 180,
    releaseDate: "2023-07-19",
    voteAverage: 82,
    backdropPath: "",
    genres: ["Drama", "History"],
    productionCompanies: [],
    extendedCredits: {
      cast: [],
      crew: []
    },
    aiGeneratedDescription: "",
    aiMatchConfidence: 100,
    dataSource: {
      tmdb: null,
      imdb: null,
      wikidata: null
    },
    lastUpdated: new Date()
  }
];