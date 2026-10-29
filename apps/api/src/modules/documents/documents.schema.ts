import { z } from "zod";

export const paramsSchema = z.object({
  workspaceId: z.string().uuid("Invalid Workspace ID format"),
});

export const deleteParamsSchema = z.object({
  workspaceId: z.string().uuid("Invalid Workspace ID format"),
  documentId: z.string().uuid("Invalid Document ID format"),
});

export const ragQueryBodySchema = z.object({
  query: z.string().min(1, "Search query must not be empty"),
});

export type RAGQueryBody = z.infer<typeof ragQueryBodySchema>;
