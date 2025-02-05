import { type Nominee } from "@shared/schema";

export const mockNominees: Nominee[] = [
  {
    id: 1,
    name: "Oppenheimer",
    category: "Best Picture",
    description: "Epic biographical thriller about J. Robert Oppenheimer and the development of the atomic bomb.",
    poster: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0",
    streamingPlatforms: ["Prime Video", "Apple TV+"],
    awards: {
      "Golden Globe": true,
      "BAFTA": true,
      "Critics Choice": true
    },
    cast: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."],
    crew: ["Christopher Nolan - Director", "Hoyte van Hoytema - Cinematographer"],
    funFacts: [
      "Shot entirely on IMAX cameras",
      "Used practical effects instead of CGI for nuclear explosion sequences"
    ]
  },
  // Add more mock nominees here
];
