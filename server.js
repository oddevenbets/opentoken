import "dotenv/config";
import express from "express";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { collectEmail } from "./database.js";

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const LLM7_API_KEY =
  process.env.LLM7_API_KEY?.trim();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, "dist");

if (!LLM7_API_KEY) {
  throw new Error(
    "Missing LLM7_API_KEY in the .env file.",
  );
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

function normalizeEmail(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

/* Health */

app.get("/api/health", (_request, response) => {
  response.json({
    status: "online",
    ai: "available",
    emailCollection: "available",
  });
});

/* Email collection */

app.post(
  "/api/email-signup",
  async (request, response) => {
    const email = normalizeEmail(
      request.body?.email,
    );

    if (!isValidEmail(email)) {
      return response.status(400).json({
        error: "Enter a valid email address.",
      });
    }

    try {
      const result = await collectEmail(email);

      if (!result.success) {
        console.error(
          "Supabase email collection error:",
          result.error?.message,
        );

        return response.status(502).json({
          error:
            "Your email could not be saved right now.",
        });
      }

      // Use the same response for new and existing emails.
      return response.json({
        success: true,
        message:
          "You're on the list. We'll keep the updates useful.",
      });
    } catch (error) {
      console.error(
        "Email collection request failed:",
        error,
      );

      return response.status(502).json({
        error:
          "Your email could not be saved right now.",
      });
    }
  },
);

/* AI chat */

app.post("/api/chat", async (request, response) => {
  const submittedMessages =
    request.body?.messages;

  if (
    !Array.isArray(submittedMessages) ||
    submittedMessages.length === 0
  ) {
    return response.status(400).json({
      error: "At least one message is required.",
    });
  }

  const messages = submittedMessages
    .slice(-12)
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(
          message.role,
        ) &&
        typeof message.content === "string",
    )
    .map((message) => ({
      role: message.role,
      content: message.content
        .trim()
        .slice(0, 4000),
    }))
    .filter(
      (message) =>
        message.content.length > 0,
    );

  if (messages.length === 0) {
    return response.status(400).json({
      error: "A valid message is required.",
    });
  }

  const abortController =
    new AbortController();

  response.on("close", () => {
    if (!response.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const llmResponse = await fetch(
      "https://api.llm7.io/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${LLM7_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: "fast",
          stream: true,
          temperature: 0.6,
          max_tokens: 900,

          messages: [
            {
              role: "system",
              content:
                "You are OpenToken, a helpful general-purpose AI assistant. Be clear, friendly, accurate, and concise. Respond using readable plain text.",
            },
            ...messages,
          ],
        }),

        signal: abortController.signal,
      },
    );

    if (
      !llmResponse.ok ||
      !llmResponse.body
    ) {
      const details = await llmResponse
        .text()
        .catch(() => "");

      console.error(
        `LLM7 returned ${llmResponse.status}:`,
        details.slice(0, 300),
      );

      if (llmResponse.status === 429) {
        return response.status(429).json({
          error:
            "AI access is busy. Please wait a moment and try again.",
        });
      }

      return response.status(502).json({
        error:
          "The AI service is temporarily unavailable.",
      });
    }

    response.status(200);

    response.setHeader(
      "Content-Type",
      "text/event-stream; charset=utf-8",
    );

    response.setHeader(
      "Cache-Control",
      "no-cache, no-transform",
    );

    response.setHeader(
      "Connection",
      "keep-alive",
    );

    response.setHeader(
      "X-Accel-Buffering",
      "no",
    );

    response.flushHeaders();

    await pipeline(
      Readable.fromWeb(llmResponse.body),
      response,
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    console.error(
      "Chat request failed:",
      error,
    );

    if (!response.headersSent) {
      response.status(502).json({
        error:
          "The AI service is temporarily unavailable.",
      });
    } else if (!response.writableEnded) {
      response.end();
    }
  }
});

/* Production frontend */

app.use(express.static(DIST_PATH));

app.use((request, response, next) => {
  if (
    request.method !== "GET" ||
    request.path.startsWith("/api/")
  ) {
    return next();
  }

  response.sendFile(
    path.join(DIST_PATH, "index.html"),
  );
});

app.use((_request, response) => {
  response.status(404).json({
    error: "Route not found.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `OpenToken running at http://localhost:${PORT}`,
  );
});