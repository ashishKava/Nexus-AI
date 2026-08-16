import "dotenv/config";
import { buildApp } from "./app.js";

const start = async () => {
  const app = buildApp();

  try {
    await app.listen({
      port: 4000,
      host: "0.0.0.0",
    });

    console.log("Nexus API running on http://localhost:4000");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
