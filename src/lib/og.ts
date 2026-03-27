import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const W = 1200;
const H = 630;

type SatoriNode = Parameters<typeof satori>[0];

function loadFonts() {
  const reg = readFileSync(join(process.cwd(), 'src/assets/fonts/inter-400.ttf'));
  const bold = readFileSync(join(process.cwd(), 'src/assets/fonts/inter-700.ttf'));
  return [
    { name: 'Inter', data: reg.buffer as ArrayBuffer, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: bold.buffer as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
  ];
}

export async function generateOgPng(projectTitle?: string): Promise<Uint8Array> {
  const fonts = loadFonts();

  let element: SatoriNode;

  if (projectTitle) {
    element = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '70px 80px',
          background: '#131210',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 52,
                fontWeight: 700,
                color: '#7aaddf',
                lineHeight: 1.2,
                maxWidth: 900,
              },
              children: projectTitle,
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 26, fontWeight: 700, color: '#e4e1db', marginBottom: 8 },
                    children: 'Felipe Tomé Pereira',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { fontSize: 18, color: '#7a7876' },
                    children: 'ML Research Portfolio · felipetp-ctrl.github.io',
                  },
                },
              ],
            },
          },
        ],
      },
    };
  } else {
    element = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '70px 80px',
          background: '#131210',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 52, fontWeight: 700, color: '#e4e1db', marginBottom: 16 },
              children: 'Felipe Tomé Pereira',
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 28, color: '#7aaddf', marginBottom: 12 },
              children: 'ML Research Portfolio',
            },
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 18, color: '#7a7876' },
              children: 'felipetp-ctrl.github.io',
            },
          },
        ],
      },
    };
  }

  const svg = await satori(element, { width: W, height: H, fonts });
  return new Resvg(svg).render().asPng();
}
