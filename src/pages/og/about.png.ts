import type { APIRoute } from 'astro';
import { generateOgPng } from '../../lib/og';

export const GET: APIRoute = async () => {
  const png = await generateOgPng('Sobre — About');
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
