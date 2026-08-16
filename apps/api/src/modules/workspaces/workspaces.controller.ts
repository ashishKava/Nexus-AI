import { FastifyReply, FastifyRequest } from "fastify";
import { WorkspaceService } from "./workspaces.service.js";
import { CreateWorkspaceBody } from "./workspaces.schema.js";

export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  async create(
    request: FastifyRequest<{ Params: { orgId: string }; Body: CreateWorkspaceBody }>,
    reply: FastifyReply
  ) {
    const workspace = await this.workspaceService.createWorkspace(
      request.params.orgId,
      request.body
    );
    return reply.status(201).send(workspace);
  }

  async list(
    request: FastifyRequest<{ Params: { orgId: string } }>,
    reply: FastifyReply
  ) {
    const workspaces = await this.workspaceService.listWorkspaces(request.params.orgId);
    return reply.send(workspaces);
  }
}
