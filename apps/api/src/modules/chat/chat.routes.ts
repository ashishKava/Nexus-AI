import { FastifyInstance } from "fastify";
import { ChatService } from "./chat.service.js";
import { ChatController } from "./chat.controller.js";
import { chatBodySchema } from "./chat.schema.js";

export async function chatRoutes(fastify: FastifyInstance) {
  const service = new ChatService(fastify.prisma);
  const controller = new ChatController(service);

  // POST /api/v1/chat
  fastify.post(
    "/",
    {
      schema: {
        body: chatBodySchema,
      },
      preHandler: [fastify.authenticate] as any,
    },
    controller.handleChat.bind(controller)
  );
}
