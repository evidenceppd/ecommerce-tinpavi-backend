import multer, { type FileFilterCallback } from 'multer';
import path from 'path';
import { pathToFileURL } from 'url';
import type { Request, RequestHandler } from 'express';
import fs from 'fs';
import sharp from 'sharp';

interface DetectedFileType {
  ext: string;
  mime: string;
}

async function detectFileType(buffer: Buffer): Promise<DetectedFileType | undefined> {
  const modulePath = require.resolve('file-type');
  const fileUrl = pathToFileURL(modulePath).href;
  const fileTypeModule = (await import(fileUrl)) as {
    fileTypeFromBuffer: (input: Uint8Array) => Promise<DetectedFileType | undefined>;
  };
  return fileTypeModule.fileTypeFromBuffer(buffer);
}

// Ensure upload directory exists at startup
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.memoryStorage();

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'));
  }
}

export const productImageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB max, 1 file per request
});

export const validateUploadedProductImage: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.file) {
      next();
      return;
    }

    const detectedType = await detectFileType(req.file.buffer);
    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

    if (req.file.mimetype === 'image/svg+xml' || detectedType?.mime === 'image/svg+xml') {
      next(new Error('INVALID_FILE_TYPE'));
      return;
    }

    if (!detectedType || !allowedMimes.has(detectedType.mime)) {
      next(new Error('INVALID_FILE_TYPE'));
      return;
    }

    const originalExt = path.extname(req.file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(req.file.originalname, originalExt));

    const maxWidth = req.body?.maxWidth ? parseInt(req.body.maxWidth as string, 10) : undefined;
    const maxHeight = req.body?.maxHeight ? parseInt(req.body.maxHeight as string, 10) : undefined;

    let fileBuffer = req.file.buffer;
    let fileExt = detectedType.ext;

    if (maxWidth && !isNaN(maxWidth)) {
      fileBuffer = await sharp(req.file.buffer)
        .resize({
          width: maxWidth,
          height: maxHeight && !isNaN(maxHeight) ? maxHeight : undefined,
          fit: 'cover',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      fileExt = 'jpg';
    }

    const storedFileName = `${Date.now()}-${safeName}.${fileExt}`;
    const absolutePath = path.join(UPLOAD_DIR, storedFileName);

    await fs.promises.writeFile(absolutePath, fileBuffer);

    req.file.filename = storedFileName;
    req.file.path = absolutePath;
    req.file.destination = UPLOAD_DIR;
    req.file.mimetype = detectedType.mime;

    next();
  } catch (error) {
    next(error);
  }
};
