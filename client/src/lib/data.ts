import { type Nominee } from "@shared/schema";

export const mockNominees: Nominee[] = [
  {
    id: 1,
    name: "Oppenheimer",
    category: "Best Picture",
    description: "Epic biographical thriller about J. Robert Oppenheimer and the development of the atomic bomb.",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
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
  {
    id: 2,
    name: "Barbie",
    category: "Best Picture",
    description: "A story about self-discovery as Barbie ventures from Barbieland into the real world.",
    poster: "https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
    streamingPlatforms: ["Max", "Prime Video"],
    awards: {
      "Golden Globe": true,
      "Critics Choice": true
    },
    cast: ["Margot Robbie", "Ryan Gosling", "America Ferrera"],
    crew: ["Greta Gerwig - Director", "Noah Baumbach - Writer"],
    funFacts: [
      "First live-action Barbie movie",
      "Used 3.5 million crystals in costume design"
    ]
  },
  {
    id: 3,
    name: "Poor Things",
    category: "Best Picture",
    description: "A young woman brought back to life by an unorthodox scientist embarks on a journey of self-discovery.",
    poster: "https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg",
    streamingPlatforms: ["Hulu", "Prime Video"],
    awards: {
      "Golden Globe": true,
      "Venice Film Festival": true
    },
    cast: ["Emma Stone", "Mark Ruffalo", "Willem Dafoe"],
    crew: ["Yorgos Lanthimos - Director", "Tony McNamara - Writer"],
    funFacts: [
      "Based on Alasdair Gray's novel",
      "Features unique Victorian-era steampunk aesthetics"
    ]
  }
];