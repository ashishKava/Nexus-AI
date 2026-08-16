import { OrganizationRepository } from "./organizations.repository.js";
import { UserRepository } from "../users/users.repository.js";
import { CreateOrganizationBody } from "./organizations.schema.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";

export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async createOrganization(data: CreateOrganizationBody) {
    // 1. Verify that the target user exists
    const userExists = await this.userRepository.findById(data.userId);
    if (!userExists) {
      throw new NotFoundError(`User with ID '${data.userId}' does not exist.`);
    }

    // 2. Verify that the slug is not already in use
    const existingOrg = await this.organizationRepository.findBySlug(data.slug);
    if (existingOrg) {
      throw new ConflictError(`Organization slug '${data.slug}' is already in use.`);
    }

    // 3. Atomically create organization and owner member
    return this.organizationRepository.createWithMember(data);
  }

  async getOrganizationById(id: string) {
    const org = await this.organizationRepository.findById(id);
    if (!org) {
      throw new NotFoundError(`Organization with ID '${id}' not found.`);
    }
    return org;
  }

  async listOrganizations(userId: string) {
    return this.organizationRepository.findByUser(userId);
  }
}
