import "dotenv/config";
import { buildApp } from "./app.js";

const start = async () => {
  const app = buildApp();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

  try {
    await app.listen({
      port,
      host: "0.0.0.0",
    });

    console.log(`Nexus API running on http://0.0.0.0:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
