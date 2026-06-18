#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PROJECT_NAME = process.env.NEON_PROJECT_NAME || "music-link-swapper";
const DATABASE_NAME = process.env.NEON_DATABASE_NAME || "music_link_swapper";
const ROLE_NAME = process.env.NEON_ROLE_NAME || "music_link_swapper_owner";
const ENV_FILE = process.env.ENV_FILE || ".env.local";

const project = runNeon([
  "projects",
  "create",
  "--name",
  PROJECT_NAME,
  "--database",
  DATABASE_NAME,
  "--role",
  ROLE_NAME,
  "--set-context",
  "--output",
  "json"
]);

const projectId = findProjectId(project.stdout);
const connection = runNeon([
  "connection-string",
  "--pooled",
  "--database-name",
  DATABASE_NAME,
  "--role-name",
  ROLE_NAME,
  ...(projectId ? ["--project-id", projectId] : []),
  "--output",
  "json"
]);

const databaseUrl = findDatabaseUrl(connection.stdout);
if (!databaseUrl) {
  fail("Neon project was created, but no DATABASE_URL could be parsed from neonctl connection-string output.");
}

writeEnvValue(ENV_FILE, "DATABASE_URL", databaseUrl);
writeEnvValue(ENV_FILE, "SPOTIFY_WEB_MATCHING_ENABLED", "true");

console.log(
  JSON.stringify(
    {
      ok: true,
      envFile: ENV_FILE,
      projectId: projectId || null,
      databaseUrlWritten: true,
      next: ["npm run check:env", "npm run check"]
    },
    null,
    2
  )
);

function runNeon(args) {
  const result = spawnSync("npx", ["neonctl", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status === 0) {
    return {
      stdout: result.stdout || "",
      stderr: result.stderr || ""
    };
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (/Awaiting authentication|Authentication timed out|api-key|auth/i.test(output)) {
    fail(
      [
        "Neon CLI is not authenticated.",
        "Run `npx neonctl auth`, complete the browser login, then run `npm run setup:neon` again.",
        output
      ].join("\n")
    );
  }

  fail(`neonctl ${args.join(" ")} failed.\n${output}`);
}

function findProjectId(output) {
  const parsed = parseJsonLoose(output);
  const candidates = [
    parsed?.project?.id,
    parsed?.id,
    parsed?.project_id,
    parsed?.projectId
  ].filter(Boolean);
  if (candidates.length) return String(candidates[0]);
  return String(output || "").match(/\b[a-z]+-[a-z]+-\d+\b/)?.[0] || "";
}

function findDatabaseUrl(output) {
  const parsed = parseJsonLoose(output);
  const candidates = [
    parsed?.connection_string,
    parsed?.connectionString,
    parsed?.url,
    parsed?.pooled_connection_string,
    parsed?.pooledConnectionString,
    typeof parsed === "string" ? parsed : ""
  ].filter(Boolean);

  for (const candidate of candidates) {
    const found = extractPostgresUrl(candidate);
    if (found) return found;
  }
  return extractPostgresUrl(output);
}

function extractPostgresUrl(value) {
  return String(value || "").match(/postgres(?:ql)?:\/\/[^\s"']+/)?.[0] || "";
}

function parseJsonLoose(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    const jsonObject = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonObject) return null;
    try {
      return JSON.parse(jsonObject);
    } catch (_nestedError) {
      return null;
    }
  }
}

function writeEnvValue(file, key, value) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const line = `${key}=${JSON.stringify(value)}`;
  const regex = new RegExp(`^${escapeRegex(key)}=.*$`, "m");
  const next = regex.test(current)
    ? current.replace(regex, line)
    : `${current.replace(/\s*$/, "")}${current.trim() ? "\n" : ""}${line}\n`;
  writeFileSync(file, next);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
