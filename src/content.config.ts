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
    metrics: z.array(z.object({
      label: z.string(),
      labelEn: z.string().optional(),
      value: z.string(),
    })).optional(),
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
    series: z.string().optional(),
    seriesOrder: z.number().optional(),
  }),
});

const highlights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/highlights' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string().optional(),
    authors: z.string(),
    url: z.string(),
    summary: z.string(),
    summaryEn: z.string().optional(),
    date: z.string(),
    active: z.boolean().default(true),
  }),
});

export const collections = { projects, blog, highlights };
