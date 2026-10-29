import { FastifyReply, FastifyRequest } from "fastify";
import { ChatService } from "./chat.service.js";
import { ChatBody } from "./chat.schema.js";

export class ChatController {
  constructor(private chatService: ChatService) {}

  async handleChat(
    request: FastifyRequest<{ Body: ChatBody }>,
    reply: FastifyReply
  ) {
    const { message, organizationId, workspaceId } = request.body;
    const userId = request.user.id;

    const chatResponse = await this.chatService.processChatMessage(
      userId,
      organizationId,
      workspaceId,
      message
    );

    return reply.send(chatResponse);
  }
}
