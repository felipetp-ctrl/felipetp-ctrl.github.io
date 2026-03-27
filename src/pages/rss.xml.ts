import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const projects = await getCollection('projects');
  return rss({
    title: 'Felipe Tomé Pereira — ML Research',
    description: 'ML Research Portfolio — machine learning, statistics and databases.',
    site: context.site!,
    items: projects
      .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
      .map((project) => ({
        title: project.data.title,
        description: project.data.description,
        pubDate: new Date(project.data.date),
        link: `/projects/${project.id}/`,
      })),
  });
}
