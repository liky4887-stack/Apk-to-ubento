// src/intake/rea-bridge.ts
// Termux-tuned bridge to morluto/rea. Spawns the termux wrapper, parses JSON.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ReaBridgeConfig {
  reaPath: string;
  nodeOptions: string;
  timeoutMs: number;
  maxBufferBytes: number;
}

export interface ReaTiming {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface ReaError {
  code: number;
  reason: string;
  stderr: string;
  stdout: string;
}

export interface ReaResult<T> {
  ok: boolean;
  data?: T;
  error?: ReaError;
  timing: ReaTiming;
}

// Shape-tolerant aliases. Real shapes discovered via getCommandSchema().
export type AndroidSnapshot = { [key: string]: unknown };
export type ClassHit = { [key: string]: unknown };
export type TraceResult = { [key: string]: unknown };
export type ResourceBundle = { [key: string]: unknown };
export type SignatureFacts = { [key: string]: unknown };
export type FlutterFacts = { [key: string]: unknown };
export type AppGraph = { [key: string]: unknown };

export const DEFAULT_CONFIG: ReaBridgeConfig = {
  reaPath:
    process.env.REA_TERMUX_PATH ||
    "/data/data/com.termux/files/home/rea/scripts/rea-termux.mjs",
  nodeOptions: process.env.REA_NODE_OPTIONS || "--max-old-space-size=4096",
  timeoutMs: 180_000,
  maxBufferBytes: 128 * 1024 * 1024,
};

async function runRea<T>(
  command: string,
  args: string[],
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<T>> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  if (!existsSync(config.reaPath)) {
    return {
      ok: false,
      timing: {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      },
      error: {
        code: -1,
        reason: `REA entrypoint missing: ${config.reaPath}`,
        stderr: "",
        stdout: "",
      },
    };
  }

  const fullArgs = [config.reaPath, command, ...args, "--format", "json"];

  return new Promise<ReaResult<T>>((resolvePromise) => {
    const child = spawn(process.execPath, fullArgs, {
      env: { ...process.env, NODE_OPTIONS: config.nodeOptions },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let aborted = false;

    const timer = setTimeout(() => {
      aborted = true;
      child.kill("SIGKILL");
    }, config.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (aborted) return;
      stdout += chunk.toString("utf8");
      if (stdout.length > config.maxBufferBytes) {
        aborted = true;
        child.kill("SIGKILL");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolvePromise({
        ok: false,
        timing: {
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - started,
        },
        error: { code: -1, reason: err.message, stderr, stdout },
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const timing: ReaTiming = {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      };

      if (aborted) {
        resolvePromise({
          ok: false,
          timing,
          error: {
            code: code ?? -1,
            reason: `aborted: timeout=${config.timeoutMs}ms or buffer=${config.maxBufferBytes}B`,
            stderr,
            stdout,
          },
        });
        return;
      }

      if (code !== 0) {
        resolvePromise({
          ok: false,
          timing,
          error: { code: code ?? -1, reason: `exit ${code}`, stderr, stdout },
        });
        return;
      }

      try {
        const data = JSON.parse(stdout) as T;
        resolvePromise({ ok: true, data, timing });
      } catch (err) {
        resolvePromise({
          ok: false,
          timing,
          error: {
            code: 0,
            reason: `JSON parse failed: ${(err as Error).message}`,
            stderr,
            stdout: stdout.slice(0, 4000),
          },
        });
      }
    });
  });
}

export function inspectApk(
  apkPath: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<AndroidSnapshot>> {
  return runRea("inspect-android-package", [resolve(apkPath)], config);
}

export function searchClasses(
  apkPath: string,
  query: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<ClassHit[]>> {
  return runRea("search-android-classes", [resolve(apkPath), query], config);
}

export function traceReferences(
  apkPath: string,
  className: string,
  options: { methodName?: string; overloadIndex?: number } = {},
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<TraceResult>> {
  const args = [resolve(apkPath), className];
  if (options.methodName !== undefined) args.push("--method-name", options.methodName);
  if (options.overloadIndex !== undefined)
    args.push("--overload-index", String(options.overloadIndex));
  return runRea("trace-android-references", args, config);
}

export function decodeResources(
  apkPath: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<ResourceBundle>> {
  return runRea("decode-android-resources", [resolve(apkPath)], config);
}

export function inspectSignature(
  apkPath: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<SignatureFacts>> {
  return runRea("inspect-apk-signature", [resolve(apkPath)], config);
}

export function identifyFlutter(
  apkPath: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<FlutterFacts>> {
  return runRea("identify-flutter-build", [resolve(apkPath)], config);
}

export function projectAppGraph(
  apkPath: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<AppGraph>> {
  return runRea("project-android-application-graph", [resolve(apkPath)], config);
}

export interface IntakeBundle {
  packageInfo: ReaResult<AndroidSnapshot>;
  signature: ReaResult<SignatureFacts>;
  flutter: ReaResult<FlutterFacts>;
  resources: ReaResult<ResourceBundle>;
}

export async function intakeApk(
  apkPath: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<IntakeBundle> {
  const [packageInfo, signature, flutter, resources] = await Promise.all([
    inspectApk(apkPath, config),
    inspectSignature(apkPath, config),
    identifyFlutter(apkPath, config),
    decodeResources(apkPath, config),
  ]);
  return { packageInfo, signature, flutter, resources };
}

// Discover the real output schema per command. Call once per command;
// paste the output, we refine the type aliases above.
export function getCommandSchema(
  command: string,
  config: ReaBridgeConfig = DEFAULT_CONFIG,
): Promise<ReaResult<unknown>> {
  return runRea(command, ["--schema"], config);
}
