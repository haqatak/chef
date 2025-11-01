import { useState, useEffect } from 'react';

export function useOllamaModels() {
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    const fetchOllamaModels = async () => {
      try {
        const response = await fetch('/api/chat');
        const data = await response.json();
        setOllamaModels(data.models);
      } catch (error) {
        console.error('Error fetching Ollama models:', error);
      }
    };

    fetchOllamaModels();
  }, []);

  return ollamaModels;
}
