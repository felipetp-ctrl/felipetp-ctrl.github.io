import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateOgPng } from '../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const projects = await getCollection('projects');
  return projects.map((p) => ({
    params: { slug: p.id },
    props: { title: p.data.title },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const png = await generateOgPng(props.title as string);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
