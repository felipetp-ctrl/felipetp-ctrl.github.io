import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext, GetStaticPaths } from 'astro';

export const getStaticPaths: GetStaticPaths = async () => {
  return [{ params: { locale: 'pt' } }, { params: { locale: 'en' } }];
};

export async function GET(context: APIContext) {
  const locale = context.params.locale === 'en' ? 'en' : 'pt';
  const projects = await getCollection('projects');
  const posts = await getCollection('blog', (p) => !p.data.draft);

  const items = [
    ...projects.map((p) => ({
      title: locale === 'en' ? (p.data.titleEn ?? p.data.title) : p.data.title,
      description: locale === 'en' ? (p.data.descriptionEn ?? p.data.description) : p.data.description,
      pubDate: new Date(p.data.date),
      link: `/${locale}/projects/${p.id}/`,
    })),
    ...posts.map((p) => ({
      title: locale === 'en' ? (p.data.titleEn ?? p.data.title) : p.data.title,
      description: locale === 'en' ? (p.data.descriptionEn ?? p.data.description) : p.data.description,
      pubDate: new Date(p.data.date),
      link: `/${locale}/blog/${p.id}/`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: locale === 'en' ? 'Felipe Tome Pereira — ML Research' : 'Felipe Tome Pereira — Pesquisa em ML',
    description:
      locale === 'en'
        ? 'ML research portfolio — machine learning, statistics and databases.'
        : 'Portfolio de pesquisa em ML — machine learning, estatistica e bancos de dados.',
    site: context.site!,
    items,
    customData: `<language>${locale === 'en' ? 'en-US' : 'pt-BR'}</language>`,
  });
}
