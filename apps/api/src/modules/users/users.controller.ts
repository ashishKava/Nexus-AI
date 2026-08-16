import { FastifyReply, FastifyRequest } from "fastify";
import { UserService } from "./users.service.js";
import { CreateUserBody } from "./users.schema.js";

export class UserController {
  constructor(private userService: UserService) {}

  async create(
    request: FastifyRequest<{ Body: CreateUserBody }>,
    reply: FastifyReply,
  ) {
    const user = await this.userService.createUser(request.body);
    return reply.status(201).send(user);
  }
}
