import { type Nominee } from "@shared/schema";

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
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Motion Picture - Drama", result: "Won" },
          { name: "Critics Choice", type: "Best Picture", result: "Won" },
          { name: "BAFTA", type: "Best Film", result: "Nominated" }
        ]
      }
    ],
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
    trailerUrl: "https://www.youtube.com/embed/pBk4NYhWNMM",
    streamingPlatforms: ["Max", "Prime Video"],
    awards: {
      "Golden Globe": true,
      "Critics Choice": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Motion Picture - Comedy", result: "Won" },
          { name: "Critics Choice", type: "Best Comedy", result: "Won" }
        ]
      }
    ],
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
    trailerUrl: "https://www.youtube.com/embed/RlbR5N6veqw",
    streamingPlatforms: ["In Theaters"],
    awards: {
      "Golden Globe": true,
      "Venice Film Festival": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Motion Picture - Comedy", result: "Won" },
          { name: "Venice Film Festival", type: "Golden Lion", result: "Won" }
        ]
      }
    ],
    cast: ["Emma Stone", "Mark Ruffalo", "Willem Dafoe"],
    crew: ["Yorgos Lanthimos - Director", "Tony McNamara - Writer"],
    funFacts: [
      "Based on Alasdair Gray's novel",
      "Features unique Victorian-era steampunk aesthetics"
    ]
  },
  {
    id: 4,
    name: "Killers of the Flower Moon",
    category: "Best Picture",
    description: "An investigation into mysterious murders of wealthy Osage people in 1920s Oklahoma.",
    poster: "https://image.tmdb.org/t/p/w500/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg",
    trailerUrl: "https://www.youtube.com/embed/EP34Yoxs3FQ",
    streamingPlatforms: ["Apple TV+"],
    awards: {
      "Golden Globe": true,
      "National Board of Review": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Motion Picture - Drama", result: "Nominated" },
          { name: "National Board of Review", type: "Top Films", result: "Won" }
        ]
      }
    ],
    cast: ["Leonardo DiCaprio", "Robert De Niro", "Lily Gladstone"],
    crew: ["Martin Scorsese - Director", "Eric Roth - Writer"],
    funFacts: [
      "Based on David Grann's non-fiction book",
      "Shot on location in Oklahoma"
    ]
  },
  {
    id: 5,
    name: "Maestro",
    category: "Best Picture",
    description: "A biopic exploring the complex relationship between Leonard Bernstein and Felicia Montealegre.",
    poster: "https://image.tmdb.org/t/p/w500/kxj7rMco6RNYsVcNwuGAIlfWu64.jpg",
    trailerUrl: "https://www.youtube.com/embed/qhkP1e8ECzM",
    streamingPlatforms: ["Netflix"],
    awards: {
      "Golden Globe": true,
      "Venice Film Festival": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Motion Picture - Drama", result: "Nominated" },
          { name: "Venice Film Festival", type: "Special Jury Prize", result: "Won" }
        ]
      }
    ],
    cast: ["Bradley Cooper", "Carey Mulligan", "Matt Bomer"],
    crew: ["Bradley Cooper - Director", "Josh Singer - Writer"],
    funFacts: [
      "Cooper spent six years learning to conduct",
      "Shot in both color and black-and-white"
    ]
  },
  {
    id: 6,
    name: "Cillian Murphy",
    category: "Best Actor",
    description: "Portrayal of J. Robert Oppenheimer in 'Oppenheimer'",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
    streamingPlatforms: ["Prime Video", "Apple TV+"],
    awards: {
      "Golden Globe": true,
      "Critics Choice": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Actor - Drama", result: "Won" },
          { name: "Critics Choice", type: "Best Actor", result: "Won" }
        ]
      }
    ],
    cast: ["Cillian Murphy"],
    crew: ["Christopher Nolan - Director"],
    funFacts: [
      "Lost significant weight for the role",
      "First Oscar nomination"
    ]
  },
  {
    id: 7,
    name: "Emma Stone",
    category: "Best Actress",
    description: "Portrayal of Bella Baxter in 'Poor Things'",
    poster: "https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg",
    trailerUrl: "https://www.youtube.com/embed/RlbR5N6veqw",
    streamingPlatforms: ["In Theaters"],
    awards: {
      "Golden Globe": true,
      "Critics Choice": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Actress - Comedy", result: "Won" },
          { name: "Critics Choice", type: "Best Actress", result: "Won" }
        ]
      }
    ],
    cast: ["Emma Stone"],
    crew: ["Yorgos Lanthimos - Director"],
    funFacts: [
      "Also served as producer",
      "Previous Oscar winner for La La Land"
    ]
  },
  {
    id: 8,
    name: "The Boy and the Heron",
    category: "Best Animated Feature",
    description: "A semi-autobiographical fantasy about a boy's journey through a mysterious world.",
    poster: "https://image.tmdb.org/t/p/w500/jDQPkgzerGJ7kLWtQ3NY4TQgIbh.jpg",
    trailerUrl: "https://www.youtube.com/embed/t5khm-VjEu4",
    streamingPlatforms: ["In Theaters"],
    awards: {
      "Golden Globe": true,
      "New York Film Critics Circle": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Golden Globe", type: "Best Animated Feature", result: "Won" },
          { name: "New York Film Critics Circle", type: "Best Animated Film", result: "Won" }
        ]
      }
    ],
    cast: ["Soma Santoki", "Masaki Suda"],
    crew: ["Hayao Miyazaki - Director", "Joe Hisaishi - Composer"],
    funFacts: [
      "Miyazaki came out of retirement to make this film",
      "Hand-drawn animation with minimal CGI"
    ]
  },
  {
    id: 9,
    name: "Perfect Days",
    category: "Best International Feature",
    description: "A contemplative look at the life of a Tokyo toilet cleaner finding beauty in everyday routines.",
    poster: "https://image.tmdb.org/t/p/w500/A6XvpfCrMX0mJJwuJ0ULyX2MpKz.jpg",
    trailerUrl: "https://www.youtube.com/embed/I8lQBn8zaTc",
    streamingPlatforms: ["In Theaters"],
    awards: {
      "Cannes Film Festival": true
    },
    historicalAwards: [
      {
        year: 2024,
        awards: [
          { name: "Cannes Film Festival", type: "Best Actor", result: "Won" }
        ]
      }
    ],
    cast: ["Koji Yakusho", "Tokio Emoto"],
    crew: ["Wim Wenders - Director"],
    funFacts: [
      "Shot entirely in Tokyo",
      "Japan's official Oscar submission"
    ]
  }
];