import { PrismaClient } from "@prisma/client";

export class DocumentsRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    name: string;
    url: string;
    mimeType: string;
    workspaceId: string;
  }) {
    return this.prisma.document.create({
      data,
    });
  }

  async findById(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
    });
  }

  async findByWorkspaceId(workspaceId: string) {
    return this.prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async delete(id: string) {
    return this.prisma.document.delete({
      where: { id },
    });
  }
}
