import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import session from "express-session";
import passport from "passport";
import { seed } from "./seed";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup session and passport for auth routes only
const sessionSettings: session.SessionOptions = {
  secret: process.env.REPL_ID!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: app.get("env") === "production",
    sameSite: "lax"
  },
  store: storage.sessionStore,
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1);
}

// Apply auth middleware to all /api routes
app.use("/api", session(sessionSettings));
app.use("/api", passport.initialize());
app.use("/api", passport.session());

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Seed the database on startup
    console.log("Seeding database...");
    await seed();
    console.log("Database seeding completed");

    const server = registerRoutes(app);

    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err as any).status || (err as any).statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Error:", err);

      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        const newPort = PORT + 1;
        log(`Port ${PORT} is in use, trying port ${newPort}`);
        server.listen(newPort, "0.0.0.0", () => {
          log(`Server running on port ${newPort}`);
        });
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Startup error:", error);
    process.exit(1);
  }
})();