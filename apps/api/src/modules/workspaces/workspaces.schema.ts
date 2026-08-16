import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createWorkspaceBodySchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters").regex(slugRegex, {
    message: "Slug must contain only lowercase alphanumeric characters and hyphens (e.g. 'my-workspace')",
  }),
});

export type CreateWorkspaceBody = z.infer<typeof createWorkspaceBodySchema>;

export const workspaceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  organizationId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
