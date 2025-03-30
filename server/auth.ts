import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

// Roles y sus permisos
export const ROLES = {
  Usuario: "Usuario",
  Admin: "Admin",
  SuperAdmin: "SuperAdmin"
};

// Definiciones de acceso por roles
export const rolPermisos = {
  [ROLES.Usuario]: [
    "compras",
    "listadosPdf"
  ],
  [ROLES.Admin]: [
    "compras", 
    "listadosPdf", 
    "dashboard", 
    "senalamientos", 
    "coincidencias", 
    "controlActividad", 
    "tiendas"
  ],
  [ROLES.SuperAdmin]: [
    "compras", 
    "listadosPdf", 
    "dashboard", 
    "senalamientos", 
    "coincidencias", 
    "controlActividad", 
    "tiendas", 
    "usuarios", 
    "configuracion"
  ]
};

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "retail-manager-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Remove password from the response
      const { password, ...userWithoutPassword } = user;

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Remove password from the response
    const { password, ...userWithoutPassword } = req.user as User;
    res.status(200).json(userWithoutPassword);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Remove password from the response
    const { password, ...userWithoutPassword } = req.user as User;
    res.json(userWithoutPassword);
  });
  
  // Middleware for role-based authorization
  const authorize = (roles: string[]) => {
    return (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const userRole = (req.user as User).role;
      if (!roles.includes(userRole)) {
        return res.status(403).json({ message: "Acceso denegado - Permisos insuficientes" });
      }
      
      next();
    };
  };
  
  // Middleware para autorización basada en permisos de módulos
  const authorizePermission = (permission: string) => {
    return (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const userRole = (req.user as User).role;
      
      // Verificar si el rol del usuario tiene permiso para acceder al módulo
      if (rolPermisos[userRole] && rolPermisos[userRole].includes(permission)) {
        return next();
      }
      
      return res.status(403).json({ 
        message: "Acceso denegado - No tiene permiso para acceder a este módulo"
      });
    };
  };
  
  // Make authorize middleware available
  app.use((req, res, next) => {
    req.authorize = authorize;
    req.authorizePermission = authorizePermission;
    next();
  });
}

// Add authorize and authorizePermission to Request type
declare global {
  namespace Express {
    interface Request {
      authorize: (roles: string[]) => (req: Express.Request, res: Express.Response, next: Express.NextFunction) => void;
      authorizePermission: (permission: string) => (req: Express.Request, res: Express.Response, next: Express.NextFunction) => void;
    }
  }
}
