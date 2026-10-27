import path from 'node:path';
import fs from 'node:fs/promises';

import mime from 'mime';
import { type NextRequest, NextResponse } from 'next/server';

import { DATA_FOLDER } from '@/app/lib/storage/constants';
import { resolveInside } from '@/app/lib/safePath';
import { withError } from '@/app/lib/withError';

const PUBLIC_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);

export const dynamic = 'force-dynamic'; // defaults to auto

interface ServeParams {
  filePath?: string[];
}

export async function GET(
  _: NextRequest,
  {
    params,
  }: {
    params: ServeParams;
  },
) {
  const { filePath } = params;

  const uriPath = Array.isArray(filePath) ? filePath.join('/') : (filePath ?? '');

  const targetPath = decodeURI(uriPath);

  const contentType = mime.getType(path.basename(targetPath));

  if (!contentType && !path.extname(targetPath)) {
    return NextResponse.next();
  }

  // Anonymous route: only images may leave DATA_FOLDER (the uploaded logo). config.json,
  // testboard.db, results and reports are never served from here.
  if (!PUBLIC_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let imageDataPath: string;
  let imagePublicPath: string;

  try {
    imageDataPath = resolveInside(DATA_FOLDER, targetPath);
    imagePublicPath = resolveInside('public', targetPath);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error: dataAccessError } = await withError(fs.access(imageDataPath));

  const imagePath = dataAccessError ? imagePublicPath : imageDataPath;

  const { result: imageBuffer, error: readError } = await withError(fs.readFile(imagePath));

  if (readError ?? !imageBuffer) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const headers = {
    headers: {
      'Content-Type': contentType ?? 'image/*',
    },
  };

  return new Response(imageBuffer, headers);
}
