import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@vercel/remix';
import { chatAction } from '~/lib/.server/chat';
import { getEnv } from '~/lib/.server/env';

export async function loader({ request }: LoaderFunctionArgs) {
  const ollamaBaseUrl = getEnv('OLLAMA_BASE_URL');
  if (!ollamaBaseUrl) {
    return json({ models: [] });
  }

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`);
    if (!response.ok) {
      console.error('Failed to fetch Ollama models:', response.statusText);
      return json({ models: [] });
    }

    const data = await response.json();
    const models = data.models.map((model: any) => model.name);
    return json({ models });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return json({ models: [] });
  }
}

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}
