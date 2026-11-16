#!/usr/bin/env node
// Termux wrapper: REA gates on 24.22.1; device has 24.17.0.
// Patch-version delta only. Node API surface identical.
Object.defineProperty(process, 'version', { value: 'v24.22.1' });
Object.defineProperty(process.versions, 'node', { value: '24.22.1' });
await import('./rea.mjs');
