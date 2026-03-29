import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateOgPng } from '../../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const locales = ['pt', 'en'] as const;
  const projects = await getCollection('projects');

  return projects.flatMap((project) =>
    locales.map((locale) => ({
      params: { locale, slug: project.id },
      props: {
        title: locale === 'en' ? (project.data.titleEn ?? project.data.title) : project.data.title,
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
