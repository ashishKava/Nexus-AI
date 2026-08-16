import { PrismaClient } from "@prisma/client";

export class WorkspaceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: { name: string; slug: string; organizationId: string }) {
    return this.prisma.workspace.create({
      data,
    });
  }

  async findBySlugAndOrg(slug: string, organizationId: string) {
    return this.prisma.workspace.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug,
        },
      },
    });
  }

  async findByOrg(organizationId: string) {
    return this.prisma.workspace.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string) {
    return this.prisma.workspace.findUnique({
      where: { id },
    });
  }
}
