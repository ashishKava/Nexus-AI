import { z } from "zod";

export const chatBodySchema = z.object({
  message: z.string().min(1, "Message content must not be empty"),
  organizationId: z.string().uuid("Invalid Organization ID format"),
  workspaceId: z.string().uuid("Invalid Workspace ID format").optional(),
});

export type ChatBody = z.infer<typeof chatBodySchema>;
