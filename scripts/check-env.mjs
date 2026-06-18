#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const ENV_FILES = [".env.local", ".env"];
const OPTIONAL_KEYS = ["MANUAL_LINK_TOKEN", "YOUTUBE_API_KEY"];
const BOOLEAN_KEYS = ["SPOTIFY_WEB_MATCHING_ENABLED"];

const fileEnv = loadEnvFiles(ENV_FILES);
const env = {
  ...fileEnv,
  ...process.env
};

const issues = [];
const warnings = [];

validateDatabaseUrl(env.DATABASE_URL, { issues, warnings });
validateBoolean("SPOTIFY_WEB_MATCHING_ENABLED", env.SPOTIFY_WEB_MATCHING_ENABLED, { issues });

for (const key of OPTIONAL_KEYS) {
  if (env[key] === undefined || env[key] === "") continue;
  if (String(env[key]).trim().length < 8) {
    warnings.push(`${key} is set but looks very short.`);
  }
}

if (issues.length) {
  console.error(["Environment check failed:", ...issues.map(item => `- ${item}`)].join("\n"));
  process.exit(1);
}

const loadedFrom = ENV_FILES.filter(file => existsSync(file));
console.log(
  JSON.stringify(
    {
      ok: true,
      loadedFrom,
      databaseUrlConfigured: Boolean(env.DATABASE_URL),
      warnings
    },
    null,
    2
  )
);

function validateDatabaseUrl(value, { issues, warnings }) {
  const raw = String(value || "").trim();
  if (!raw) {
    warnings.push("DATABASE_URL is not set. Persistent shared cache is disabled until a Postgres/Neon URL is configured.");
    return;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_error) {
    issues.push("DATABASE_URL must be a valid URL.");
    return;
  }

  if (parsed.protocol === "pglite:") {
    return;
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    issues.push("DATABASE_URL must use postgres://, postgresql://, or pglite://.");
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
    issues.push("DATABASE_URL must include a host and database name.");
  }
  if (!parsed.searchParams.has("sslmode")) {
    warnings.push("DATABASE_URL has no sslmode parameter. Neon/Vercel production should usually use sslmode=require.");
  }
}

function validateBoolean(key, value, { issues }) {
  if (value === undefined || value === "") return;
  const normalized = String(value).trim().toLowerCase();
  if (!["true", "false", "1", "0", "yes", "no"].includes(normalized)) {
    issues.push(`${key} must be true or false when set.`);
  }
}

function loadEnvFiles(files) {
  const values = {};
  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (values[key] !== undefined) continue;
      values[key] = unquote(rawValue.trim());
    }
  }
  return values;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
