import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3010);

createApp().listen(PORT, () => {
  const mode = process.env.OPENAI_API_KEY ? 'openai' : 'mock';
  console.log(`kerkit gallery on http://localhost:${PORT}  (assistant: ${mode} provider)`);
  console.log('Scenes:  /privacy  ·  /assistant  ·  /dashboard');
});
