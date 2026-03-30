import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  return [{ params: { locale: 'pt' } }, { params: { locale: 'en' } }];
}

export const GET: APIRoute = async ({ params }) => {
  const { locale } = params as { locale: 'pt' | 'en' };

  const projects = await getCollection('projects');
  const posts = await getCollection('blog', (p) => !p.data.draft);

  const data = [
    ...projects.map((p) => ({
      type: 'project',
      title: p.data.title,
      titleEn: p.data.titleEn ?? p.data.title,
      description: p.data.description,
      descriptionEn: p.data.descriptionEn ?? p.data.description,
      tags: p.data.technologies,
      url: `/${locale}/projects/${p.id}`,
    })),
    ...posts.map((p) => ({
      type: 'blog',
      title: p.data.title,
      titleEn: p.data.titleEn ?? p.data.title,
      description: p.data.description,
      descriptionEn: p.data.descriptionEn ?? p.data.description,
      tags: p.data.tags,
      url: `/${locale}/blog/${p.id}`,
    })),
  ];

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
