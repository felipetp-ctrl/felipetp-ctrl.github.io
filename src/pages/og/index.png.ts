import type { APIRoute } from 'astro';
import { generateOgPng } from '../../lib/og';

export const GET: APIRoute = async () => {
  const png = await generateOgPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
