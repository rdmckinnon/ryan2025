import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    summary: z.string().max(280),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false)
  })
});

export const collections = {
  blog
};
