import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** ถ้าตั้งค่า COMPILE_SERVER_URL (เช่นเว็บนี้ที่รันด้วย Docker บน Render/Railway) จะส่งต่อไปคอมไพล์ที่นั่น */
const COMPILE_SERVER_URL = process.env.COMPILE_SERVER_URL?.replace(/\/+$/, "");
const NO_COMPILER = "เซิร์ฟเวอร์นี้ไม่มี arduino-cli (เช่น Vercel) — ตั้งค่า COMPILE_SERVER_URL หรือดาวน์โหลด .ino ไปอัปโหลดด้วย Arduino IDE";

const run = promisify(execFile);
const ARDUINO_CLI = process.env.ARDUINO_CLI_PATH || "arduino-cli";
const ALLOWED_FQBN = /^esp32:esp32:[a-z0-9_]+(:[A-Za-z0-9_=,]+)?$/;

interface CompileBody {
  code: string;
  fqbn: string;
  bootloaderAddress?: number;
}

/**
 * POST /api/compile
 * รับซอร์สโค้ด Arduino (.ino) → คอมไพล์ด้วย arduino-cli → ส่งไฟล์ .bin กลับเป็น base64
 */
export async function POST(req: Request) {
  let body: CompileBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, log: "Invalid JSON body" }, { status: 400 });
  }

  if (COMPILE_SERVER_URL) {
    try {
      const res = await fetch(`${COMPILE_SERVER_URL}/api/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.COMPILE_SERVER_TOKEN ? { "x-compile-token": process.env.COMPILE_SERVER_TOKEN } : {}) },
        body: JSON.stringify(body),
      });
      return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return NextResponse.json({ ok: false, log: `ติดต่อเซิร์ฟเวอร์คอมไพล์ไม่ได้: ${(e as Error).message}` }, { status: 502 });
    }
  }
  if (process.env.VERCEL) return NextResponse.json({ ok: false, log: NO_COMPILER }, { status: 501 });
  if (process.env.COMPILE_SERVER_TOKEN && req.headers.get("x-compile-token") !== process.env.COMPILE_SERVER_TOKEN) {
    return NextResponse.json({ ok: false, log: "unauthorized" }, { status: 401 });
  }

  const { code, fqbn, bootloaderAddress = 0x1000 } = body;
  if (typeof code !== "string" || code.length === 0 || code.length > 500_000) {
    return NextResponse.json({ ok: false, log: "code ว่างหรือใหญ่เกินไป" }, { status: 400 });
  }
  if (typeof fqbn !== "string" || !ALLOWED_FQBN.test(fqbn)) {
    return NextResponse.json({ ok: false, log: `FQBN ไม่ถูกต้อง: ${fqbn}` }, { status: 400 });
  }

  const work = await mkdtemp(path.join(tmpdir(), "esp32-build-"));
  const sketchDir = path.join(work, "sketch");
  const outDir = path.join(work, "out");

  try {
    await mkdir(sketchDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(sketchDir, "sketch.ino"), code, "utf8");

    let log = "";
    try {
      const { stdout, stderr } = await run(
        ARDUINO_CLI,
        // Render Free มี RAM 512 MB จึงจำกัดให้คอมไพล์ทีละงาน
        // เพื่อลดโอกาสที่ process จะถูกปิดเพราะใช้หน่วยความจำเกิน
        ["compile", "--jobs", "1", "--fqbn", fqbn, "--output-dir", outDir, sketchDir],
        { timeout: 5 * 60_000, maxBuffer: 20 * 1024 * 1024 },
      );
      log = stdout + stderr;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string; code?: string };
      if (e.code === "ENOENT") return NextResponse.json({ ok: false, log: NO_COMPILER }, { status: 501 });
      const hint = "";
      return NextResponse.json(
        { ok: false, log: (e.stdout ?? "") + (e.stderr ?? "") + (e.stdout || e.stderr ? "" : e.message) + hint },
        { status: 422 },
      );
    }

    const files = await readdir(outDir);
    const pick = (suffix: string) => files.find((f) => f.endsWith(suffix));
    const toB64 = async (f: string) => (await readFile(path.join(outDir, f))).toString("base64");
    const mergedToB64 = async (f: string) => {
      const data = await readFile(path.join(outDir, f));
      let end = data.length;
      while (end > 0 && data[end - 1] === 0xff) end--;
      end = Math.min(data.length, Math.ceil(end / 4096) * 4096);
      return data.subarray(0, end).toString("base64");
    };

    const images: { name: string; address: number; data: string }[] = [];
    const merged = pick(".ino.merged.bin");

    if (merged) {
      // esp32 core 3.x สร้างไฟล์ merged (bootloader+partitions+app) ให้ แฟลชที่ 0x0 ได้เลย
      images.push({ name: merged, address: 0x0, data: await mergedToB64(merged) });
    } else {
      const boot = pick(".ino.bootloader.bin");
      const part = pick(".ino.partitions.bin");
      const app = files.find((f) => f.endsWith(".ino.bin"));
      if (!app) throw new Error("ไม่พบไฟล์ .bin หลังคอมไพล์");
      if (boot) images.push({ name: boot, address: bootloaderAddress, data: await toB64(boot) });
      if (part) images.push({ name: part, address: 0x8000, data: await toB64(part) });
      images.push({ name: app, address: 0x10000, data: await toB64(app) });
    }

    return NextResponse.json({ ok: true, log, images });
  } catch (err) {
    return NextResponse.json({ ok: false, log: (err as Error).message }, { status: 500 });
  } finally {
    rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
