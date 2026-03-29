import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateOgPng } from '../../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog', p => !p.data.draft);
  return posts.map(p => ({ params: { slug: p.id }, props: { title: p.data.title } }));
};

export const GET: APIRoute = async ({ props }) => {
  const png = await generateOgPng(props.title as string);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
