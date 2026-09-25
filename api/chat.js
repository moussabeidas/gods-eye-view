// Vercel serverless entry: POST /api/chat (Claude when ANTHROPIC_API_KEY is set, else the offline analyst)
import { handleApi } from '../server/api.js';

export default function handler(req, res) {
  return handleApi(req, res);
}
