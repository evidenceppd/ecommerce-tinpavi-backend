import type { Request, Response } from 'express';
import { SeoService } from './seo.service';

const service = new SeoService();

export async function sitemapController(_req: Request, res: Response): Promise<void> {
  try {
    const xml = await service.generateSitemap();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(xml);
  } catch {
    res.status(500).send('Internal server error');
  }
}

export function robotsTxtController(_req: Request, res: Response): void {
  const content = service.getRobotsTxt();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(content);
}

export async function productSchemaController(req: Request, res: Response): Promise<void> {
  try {
    const schema = await service.getProductSchema(String(req.params['slug'] ?? ''));
    res.setHeader('Content-Type', 'application/ld+json');
    res.status(200).json(schema);
  } catch (err) {
    if ((err as Error).message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ error: 'Product not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export async function categorySchemaController(req: Request, res: Response): Promise<void> {
  try {
    const schema = await service.getCategorySchema(String(req.params['slug'] ?? ''));
    res.setHeader('Content-Type', 'application/ld+json');
    res.status(200).json(schema);
  } catch (err) {
    if ((err as Error).message === 'CATEGORY_NOT_FOUND') {
      res.status(404).json({ error: 'Category not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
