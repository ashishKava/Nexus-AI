import { WorkspaceRepository } from "./workspaces.repository.js";
import { CreateWorkspaceBody } from "./workspaces.schema.js";
import { ConflictError } from "../../utils/errors.js";

export class WorkspaceService {
  constructor(private workspaceRepository: WorkspaceRepository) {}

  async createWorkspace(orgId: string, data: CreateWorkspaceBody) {
    // 1. Verify workspace slug is unique within this organization boundary
    const existingWorkspace = await this.workspaceRepository.findBySlugAndOrg(
      data.slug,
      orgId
    );

    if (existingWorkspace) {
      throw new ConflictError(
        `Workspace slug '${data.slug}' is already in use within this organization.`
      );
    }

    // 2. Create the workspace
    return this.workspaceRepository.create({
      name: data.name,
      slug: data.slug,
      organizationId: orgId,
    });
  }

  async listWorkspaces(orgId: string) {
    return this.workspaceRepository.findByOrg(orgId);
  }
}
