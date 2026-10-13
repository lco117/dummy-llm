// Vercel entry point. vercel.json rewrites every path here and passes the original
// path in ?__path=, which the adapter restores before handing the request to the app.
import handler, { config as runtimeConfig } from "../src/adapters/vercel.ts";

export const config = runtimeConfig;
export default handler;
