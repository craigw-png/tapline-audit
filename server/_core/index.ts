import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getAuditById, getCompetitorsByAuditId } from "../db";
import { generateAuditHTML } from "../pdfGenerator";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ─── PDF Export Route ──────────────────────────────────────────────────────
  app.get("/api/audit/:id/pdf", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid audit ID" });
        return;
      }

      const audit = await getAuditById(id);
      if (!audit) {
        res.status(404).json({ error: "Audit not found" });
        return;
      }

      const competitors = await getCompetitorsByAuditId(id);
      const html = generateAuditHTML(audit, competitors);

      // Use puppeteer to generate PDF
      try {
        const puppeteer = await import("puppeteer-core");
        const chromium = await import("@sparticuz/chromium");

        const browser = await puppeteer.default.launch({
          args: chromium.default.args,
          executablePath: await chromium.default.executablePath(),
          headless: true,
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });
        await new Promise(r => setTimeout(r, 1000));

        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });

        await browser.close();

        const filename = `tapline-audit-${audit.brandName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${audit.period}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(Buffer.from(pdf));
      } catch (puppeteerError) {
        // Fallback: return HTML for printing if Puppeteer fails
        console.warn("[PDF] Puppeteer failed, returning HTML:", puppeteerError);
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      }
    } catch (error) {
      console.error("[PDF] Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // ─── tRPC API ──────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
