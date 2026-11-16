// src/smoke-test.ts
import {
  DEFAULT_CONFIG,
  intakeApk,
  getCommandSchema,
  inspectApk,
} from "./intake/rea-bridge.ts";

async function main(): Promise<void> {
  console.log("=== rea-bridge smoke test ===");
  console.log("reaPath:", DEFAULT_CONFIG.reaPath);
  console.log("nodeOptions:", DEFAULT_CONFIG.nodeOptions);
  console.log("");

  // Test 1: error path — nonexistent APK. Must return ok:false, clean reason.
  console.log("[1] error path — nonexistent APK");
  const missing = await inspectApk("/nonexistent/app.apk");
  console.log("  ok:", missing.ok);
  console.log("  reason:", missing.error?.reason);
  console.log("  durationMs:", missing.timing.durationMs);
  console.log("");

  // Test 2: schema — proves spawn + JSON parse work end to end.
  console.log("[2] schema discovery — inspect-android-package");
  const schema = await getCommandSchema("inspect-android-package");
  console.log("  ok:", schema.ok);
  if (schema.ok) {
    console.log("  keys:", Object.keys(schema.data as object).slice(0, 8));
  } else {
    console.log("  reason:", schema.error?.reason);
    console.log("  stderr head:", schema.error?.stderr.slice(0, 300));
    console.log("  stdout head:", schema.error?.stdout.slice(0, 300));
  }
  console.log("");

  // Test 3: real APK — only if provided as argv[2].
  const apkPath = process.argv[2];
  if (!apkPath) {
    console.log("[3] real APK — SKIPPED (no path provided)");
    console.log("    run: node src/smoke-test.ts /path/to/app.apk");
    return;
  }

  console.log("[3] full intake —", apkPath);
  const bundle = await intakeApk(apkPath);
  for (const [label, result] of Object.entries(bundle)) {
    console.log(`  ${label}.ok:`, result.ok);
    if (!result.ok) {
      console.log(`  ${label}.reason:`, result.error?.reason);
    }
    console.log(`  ${label}.durationMs:`, result.timing.durationMs);
  }
  console.log("");

  console.log("=== done ===");
  console.log("paste this block back; types refine next pour");
}

main().catch((err) => {
  console.error("smoke test failed:", err);
  process.exit(1);
});
