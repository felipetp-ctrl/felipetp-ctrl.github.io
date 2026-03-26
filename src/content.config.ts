import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    mainResult: z.string(),
    date: z.string(),
    github: z.string().optional(),
    paper: z.string().optional(),
    demo: z.string().optional(),
    featured: z.boolean().default(false),
    status: z.enum(['completed', 'in-progress', 'published']).default('completed'),
    study: z.boolean().default(false),
    order: z.number().default(99),
  }),
});

export const collections = { projects };
