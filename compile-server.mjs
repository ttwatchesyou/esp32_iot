import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);
const port = Number(process.env.PORT || 10000);
const token = process.env.COMPILE_SERVER_TOKEN || "";
const allowedFqbn = /^esp32:esp32:[a-z0-9_]+(:[A-Za-z0-9_=,]+)?$/;
let compiling = false;

function reply(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  res.end(json);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 600_000) throw new Error("request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function compile(body) {
  const { code, fqbn, bootloaderAddress = 0x1000 } = body ?? {};
  if (typeof code !== "string" || code.length === 0 || code.length > 500_000) {
    return [400, { ok: false, log: "code ว่างหรือใหญ่เกินไป" }];
  }
  if (typeof fqbn !== "string" || !allowedFqbn.test(fqbn)) {
    return [400, { ok: false, log: `FQBN ไม่ถูกต้อง: ${fqbn}` }];
  }

  const work = await mkdtemp(path.join(tmpdir(), "esp32-build-"));
  const sketchDir = path.join(work, "sketch");
  const outDir = path.join(work, "out");

  try {
    await Promise.all([mkdir(sketchDir, { recursive: true }), mkdir(outDir, { recursive: true })]);
    await writeFile(path.join(sketchDir, "sketch.ino"), code, "utf8");

    let log = "";
    try {
      const result = await run(
        "arduino-cli",
        ["compile", "--jobs", "1", "--fqbn", fqbn, "--output-dir", outDir, sketchDir],
        { timeout: 5 * 60_000, maxBuffer: 20 * 1024 * 1024 },
      );
      log = result.stdout + result.stderr;
    } catch (error) {
      return [422, {
        ok: false,
        log: (error.stdout ?? "") + (error.stderr ?? "") || error.message,
      }];
    }

    const files = await readdir(outDir);
    const pick = (suffix) => files.find((file) => file.endsWith(suffix));
    const toBase64 = async (file) => (await readFile(path.join(outDir, file))).toString("base64");
    const mergedToBase64 = async (file) => {
      const data = await readFile(path.join(outDir, file));
      let end = data.length;
      while (end > 0 && data[end - 1] === 0xff) end--;
      end = Math.min(data.length, Math.ceil(end / 4096) * 4096);
      return data.subarray(0, end).toString("base64");
    };
    const images = [];
    const merged = pick(".ino.merged.bin");

    if (merged) {
      // The ESP32 tool pads merged images to the full flash size with 0xFF.
      // Sending that padding wastes several MB of RAM and response bandwidth.
      images.push({ name: merged, address: 0, data: await mergedToBase64(merged) });
    } else {
      const boot = pick(".ino.bootloader.bin");
      const partitions = pick(".ino.partitions.bin");
      const app = files.find((file) => file.endsWith(".ino.bin"));
      if (!app) throw new Error("ไม่พบไฟล์ .bin หลังคอมไพล์");
      if (boot) images.push({ name: boot, address: bootloaderAddress, data: await toBase64(boot) });
      if (partitions) images.push({ name: partitions, address: 0x8000, data: await toBase64(partitions) });
      images.push({ name: app, address: 0x10000, data: await toBase64(app) });
    }

    return [200, { ok: true, log, images }];
  } catch (error) {
    return [500, { ok: false, log: error.message }];
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    return reply(res, 200, { ok: true, service: "ESP32 IoT Studio compiler" });
  }
  if (req.method !== "POST" || req.url !== "/api/compile") {
    return reply(res, 404, { ok: false, log: "not found" });
  }
  if (!token) {
    return reply(res, 503, { ok: false, log: "compile server token is not configured" });
  }
  if (token && req.headers["x-compile-token"] !== token) {
    return reply(res, 401, { ok: false, log: "unauthorized" });
  }
  if (compiling) {
    return reply(res, 429, { ok: false, log: "เครื่องคอมไพล์กำลังทำงาน กรุณาลองใหม่อีกครั้ง" });
  }

  compiling = true;
  try {
    const [status, body] = await compile(await readJson(req));
    return reply(res, status, body);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error.message === "request too large" ? 413 : 500;
    return reply(res, status, { ok: false, log: error.message });
  } finally {
    compiling = false;
  }
});

server.requestTimeout = 6 * 60_000;
server.headersTimeout = 6 * 60_000 + 5_000;
server.listen(port, "0.0.0.0", () => {
  console.log(`ESP32 compiler listening on ${port}`);
});
