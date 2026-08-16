import { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";
import { SignupBody, LoginBody } from "./auth.schema.js";

export class AuthController {
  constructor(private authService: AuthService) {}

  async signup(
    request: FastifyRequest<{ Body: SignupBody }>,
    reply: FastifyReply
  ) {
    const user = await this.authService.signup(request.body);
    
    // Sign JWT token using Fastify jwt utility
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
    });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  }

  async login(
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply
  ) {
    const user = await this.authService.login(request.body);

    // Sign JWT token using Fastify jwt utility
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  }
}
