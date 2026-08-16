import { FastifyReply, FastifyRequest } from "fastify";
import { OrganizationService } from "./organizations.service.js";
import { CreateOrganizationBody } from "./organizations.schema.js";

export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  async create(
    request: FastifyRequest<{ Body: CreateOrganizationBody }>,
    reply: FastifyReply
  ) {
    const org = await this.organizationService.createOrganization(request.body);
    return reply.status(201).send(org);
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const org = await this.organizationService.getOrganizationById(request.params.id);
    return reply.send(org);
  }

  async list(
    request: FastifyRequest<{ Querystring: { userId: string } }>,
    reply: FastifyReply
  ) {
    const orgs = await this.organizationService.listOrganizations(request.query.userId);
    return reply.send(orgs);
  }
}
