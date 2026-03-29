import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateOgPng } from '../../../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const locales = ['pt', 'en'] as const;
  const posts = await getCollection('blog', (p) => !p.data.draft);

  return posts.flatMap((post) =>
    locales.map((locale) => ({
      params: { locale, slug: post.id },
      props: {
        title: locale === 'en' ? (post.data.titleEn ?? post.data.title) : post.data.title,
        locale,
      },
    })),
  );
};

export const GET: APIRoute = async ({ props }) => {
  const title = props.title as string;
  const locale = props.locale === 'en' ? 'en' : 'pt';
  const png = await generateOgPng(title, locale);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
