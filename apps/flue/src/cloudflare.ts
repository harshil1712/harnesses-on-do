// Named exports become Worker exports.
// The Cloudflare Computer shell dials back to the workspace through this loopback.
export { WorkspaceServiceProxy } from '@cloudflare/computer';
export { Metering } from '@harnesses-on-do/shared/metering';
