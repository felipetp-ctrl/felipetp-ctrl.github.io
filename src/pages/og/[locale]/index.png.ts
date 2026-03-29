import type { APIRoute, GetStaticPaths } from 'astro';
import { generateOgPng } from '../../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  return [{ params: { locale: 'pt' } }, { params: { locale: 'en' } }];
};

export const GET: APIRoute = async ({ params }) => {
  const locale = params.locale === 'en' ? 'en' : 'pt';
  const png = await generateOgPng(undefined, locale);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
