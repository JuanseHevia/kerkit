import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3010);

createApp().listen(PORT, () => {
  console.log(`minimal-caretaker demo on http://localhost:${PORT}`);
  console.log('Try:');
  console.log(`  curl http://localhost:${PORT}/context`);
  console.log(
    `  curl -X POST http://localhost:${PORT}/chat -H 'content-type: application/json' -d '{"message":"¿Cómo viene el trámite de la medicación?"}'`,
  );
  console.log(`  curl http://localhost:${PORT}/privacy/export`);
});
