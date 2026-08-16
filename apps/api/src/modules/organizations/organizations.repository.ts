import { PrismaClient, OrganizationRole } from "@prisma/client";

export class OrganizationRepository {
  constructor(private prisma: PrismaClient) {}

  async createWithMember(data: { name: string; slug: string; userId: string }) {
    // Run both operations atomically in a transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the Organization
      const organization = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
        },
      });

      // 2. Create the owner OrganizationMember membership
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: data.userId,
          role: OrganizationRole.OWNER,
        },
      });

      return organization;
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  async findById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }
}
