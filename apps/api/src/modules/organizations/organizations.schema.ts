import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createOrganizationBodySchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z.string().min(2, "Slug must be at least 2 characters").regex(slugRegex, {
    message: "Slug must contain only lowercase alphanumeric characters and hyphens (e.g. 'my-org')",
  }),
  userId: z.string().uuid("Invalid User ID format"),
});

export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;

export const organizationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
