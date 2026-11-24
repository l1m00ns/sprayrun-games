import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: false, // the engine boots once on mount; double-invoked effects would be pointless
  turbopack: { root },
  poweredByHeader: false,
};
