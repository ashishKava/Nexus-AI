import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { OrganizationMember, OrganizationRole } from "@prisma/client";

// Module augmentations for request.membership
declare module "fastify" {
  interface FastifyRequest {
    membership?: OrganizationMember;
  }
}

// Module augmentations for FastifyInstance to include rbac helpers
declare module "fastify" {
  interface FastifyInstance {
    requireOrgMember: (
      allowedRoles?: OrganizationRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const rbacPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("requireOrgMember", (allowedRoles?: OrganizationRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // 1. Ensure user is authenticated (authenticate hook should have run first)
      if (!request.user) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "User authentication required",
        });
      }

      // 2. Resolve organization parameter (orgId or organizationId)
      const orgId = (request.params as any).orgId || (request.params as any).organizationId;
      if (!orgId) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Organization ID is required for access control",
        });
      }

      // 3. Load user's membership in the target organization
      const membership = await fastify.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: request.user.id,
            organizationId: orgId,
          },
        },
      });

      if (!membership) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: "You are not a member of this organization",
        });
      }

      // 4. Verify user has appropriate role permissions
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: "Insufficient permissions to perform this action",
        });
      }

      // Attach membership to request context
      request.membership = membership;
    };
  });
};

export default fp(rbacPlugin, {
  name: "rbac",
  dependencies: ["prisma", "auth"], // prisma and auth plugins must be loaded first
});
