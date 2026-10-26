/**
 * Frees the dev port before `next dev` tries to bind it.
 *
 * Without this, re-running the dev config in the IDE dies with EADDRINUSE
 * because the previous server still holds the socket. Wired up as `predev`,
 * so it runs automatically on `yarn dev` / `npm run dev`.
 *
 * Cross-platform, matches the whole team: Windows (`netstat` + `taskkill`),
 * Linux (`ss` → `fuser` → `lsof`), macOS (`lsof`).
 *
 * SAFETY: only ever kills processes *listening* on the port. A bare
 * `lsof -ti tcp:PORT` also matches clients *connected to* it — on this
 * machine that returns the browser's PID, and killing that would close
 * your browser. Every lookup below is LISTEN-scoped for that reason.
 *
 * Usage: `node scripts/free-port.mjs <port>`
 */
import { execFileSync } from "node:child_process";

const port = process.argv[2] ?? "3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return ""; // tool missing, or no match — both mean "nothing to do"
  }
};

function listenerPids() {
  const found = new Set();

  if (process.platform === "win32") {
    // netstat: ships with every Windows. LISTENING lines only; last column is PID.
    // `  TCP    0.0.0.0:3100           0.0.0.0:0              LISTENING       12345`
    for (const line of run("netstat", ["-ano"]).split(/\r?\n/)) {
      const t = line.trim().split(/\s+/);
      if (t[0] === "TCP" && t[3] === "LISTENING" && t[1]?.endsWith(`:${port}`)) {
        if (/^\d+$/.test(t[4])) found.add(t[4]);
      }
    }
  } else {
    // ss: most reliable on Linux. `users:(("next-server",pid=1234,fd=22))`
    for (const m of run("ss", ["-lptnH", `sport = :${port}`]).matchAll(/pid=(\d+)/g)) {
      found.add(m[1]);
    }

    // fuser: only reports the listener for a tcp port
    if (found.size === 0) {
      for (const pid of run("fuser", [`${port}/tcp`]).trim().split(/\s+/)) {
        if (/^\d+$/.test(pid)) found.add(pid);
      }
    }

    // lsof: macOS / systems without ss or fuser. -sTCP:LISTEN is what keeps this safe.
    if (found.size === 0) {
      for (const pid of run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]).trim().split(/\n/)) {
        if (/^\d+$/.test(pid)) found.add(pid);
      }
    }
  }

  found.delete(String(process.pid));
  found.delete(String(process.ppid));
  return [...found];
}

let pids = listenerPids();
if (pids.length === 0) process.exit(0);

// Windows has no signals: taskkill /F terminates outright. Unix: SIGTERM
// first so next dev can exit cleanly, SIGKILL if it still holds the port.
const signals = process.platform === "win32" ? ["FORCE"] : ["SIGTERM", "SIGKILL"];
for (const signal of signals) {
  for (const pid of pids) {
    try {
      if (signal === "FORCE") {
        execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: ["ignore", "pipe", "ignore"] });
        console.log(`free-port: taskkill /PID ${pid} (port ${port})`);
      } else {
        process.kill(Number(pid), signal);
        console.log(`free-port: ${signal} → pid ${pid} (port ${port})`);
      }
    } catch {
      /* already gone */
    }
  }

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    await sleep(100);
    pids = listenerPids();
    if (pids.length === 0) process.exit(0);
  }
}

console.warn(`free-port: port ${port} still held by ${pids.join(", ")} — next dev may fail.`);
