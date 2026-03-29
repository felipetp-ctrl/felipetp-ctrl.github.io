import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const projects = await getCollection('projects');
  const posts = await getCollection('blog', p => !p.data.draft);

  const items = [
    ...projects.map(p => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: new Date(p.data.date),
      link: `/projects/${p.id}/`,
    })),
    ...posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: new Date(p.data.date),
      link: `/blog/${p.id}/`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Felipe Tomé Pereira — ML Research',
    description: 'ML Research Portfolio — machine learning, statistics and databases.',
    site: context.site!,
    items,
  });
}
