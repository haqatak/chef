import { json } from '@vercel/remix';
import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return json({ sha: null }, { status: 200 });
}
