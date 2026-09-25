// Vercel serverless entry: GET /api/health
import { handleApi } from '../server/api.js';

export default function handler(req, res) {
  return handleApi(req, res);
}
