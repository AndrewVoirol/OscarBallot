import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import session from "express-session";
import passport from "passport";

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
  const server = registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
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
  const MAX_PORT_ATTEMPTS = 10;

  const startServer = async (initialPort: number) => {
    for (let port = initialPort; port < initialPort + MAX_PORT_ATTEMPTS; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          server.listen(port, "0.0.0.0", () => {
            log(`Server running on port ${port}`);
            resolve();
          }).on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
              log(`Port ${port} is in use, trying next port...`);
            } else {
              reject(err);
            }
          });
        });
        return; // Successfully started server
      } catch (err) {
        if (port === initialPort + MAX_PORT_ATTEMPTS - 1) {
          throw new Error(`Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts`);
        }
      }
    }
  };

  try {
    await startServer(PORT);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();