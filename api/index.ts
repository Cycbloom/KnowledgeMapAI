/**
 * Vercel API Entry - Single Serverless Function
 * All API routes are handled by Express app
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from './app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
