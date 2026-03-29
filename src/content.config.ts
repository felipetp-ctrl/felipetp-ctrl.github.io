import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string().optional(),
    description: z.string(),
    descriptionEn: z.string().optional(),
    technologies: z.array(z.string()),
    mainResult: z.string(),
    mainResultEn: z.string().optional(),
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

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string().optional(),
    description: z.string(),
    descriptionEn: z.string().optional(),
    date: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, blog };
