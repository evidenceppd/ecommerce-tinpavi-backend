import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBlogFindMany,
  mockBlogFindUnique,
  mockBlogCreate,
  mockBlogUpdate,
  mockBlogDelete,
} = vi.hoisted(() => ({
  mockBlogFindMany: vi.fn(),
  mockBlogFindUnique: vi.fn(),
  mockBlogCreate: vi.fn(),
  mockBlogUpdate: vi.fn(),
  mockBlogDelete: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    blog: {
      findMany: mockBlogFindMany,
      findUnique: mockBlogFindUnique,
      create: mockBlogCreate,
      update: mockBlogUpdate,
      delete: mockBlogDelete,
    },
  },
}));

import { blogsService } from '../blogs.service';

const FULL_BLOG = {
  id: 1,
  categoria: 'tecnologia',
  titulo: 'Artigo de teste',
  descricao: 'Descricao curta do artigo',
  materia: '<p>Conteudo completo do artigo</p>',
  imagem_capa: 'https://cdn.example.com/capa.jpg',
  imagem_banner: 'https://cdn.example.com/banner.jpg',
  imagem_banner_mobile: 'https://cdn.example.com/banner-mobile.jpg',
  publicado: true,
  data_publicacao: new Date('2026-01-15T10:00:00.000Z'),
  createdAt: new Date('2026-01-14T08:00:00.000Z'),
  updatedAt: new Date('2026-01-14T08:00:00.000Z'),
};

describe('blogsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('persists all mandatory and optional Blog fields', async () => {
      mockBlogCreate.mockResolvedValue(FULL_BLOG);

      const result = await blogsService.create({
        categoria: 'tecnologia',
        titulo: 'Artigo de teste',
        descricao: 'Descricao curta do artigo',
        materia: '<p>Conteudo completo do artigo</p>',
        imagem_capa: 'https://cdn.example.com/capa.jpg',
        imagem_banner: 'https://cdn.example.com/banner.jpg',
        imagem_banner_mobile: 'https://cdn.example.com/banner-mobile.jpg',
        publicado: true,
        data_publicacao: '2026-01-15T10:00:00.000Z',
      });

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoria: 'tecnologia',
            titulo: 'Artigo de teste',
            descricao: 'Descricao curta do artigo',
            materia: '<p>Conteudo completo do artigo</p>',
            imagem_capa: 'https://cdn.example.com/capa.jpg',
            imagem_banner: 'https://cdn.example.com/banner.jpg',
            imagem_banner_mobile: 'https://cdn.example.com/banner-mobile.jpg',
            publicado: true,
          }),
        }),
      );

      const callData = mockBlogCreate.mock.calls[0][0].data;
      expect(callData.data_publicacao).toBeInstanceOf(Date);
      expect(callData.data_publicacao.toISOString()).toBe('2026-01-15T10:00:00.000Z');

      expect(result).toMatchObject({ id: 1, titulo: 'Artigo de teste' });
    });

    it('defaults categoria to empty string when omitted', async () => {
      mockBlogCreate.mockResolvedValue({ ...FULL_BLOG, categoria: '' });

      await blogsService.create({
        titulo: 'Sem categoria',
        descricao: 'desc',
        materia: 'materia',
      });

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoria: '' }),
        }),
      );
    });

    it('defaults publicado to true when omitted', async () => {
      mockBlogCreate.mockResolvedValue({ ...FULL_BLOG, publicado: true });

      await blogsService.create({
        titulo: 'Sem publicado',
        descricao: 'desc',
        materia: 'materia',
      });

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publicado: true }),
        }),
      );
    });

    it('sets nullable image fields to null when omitted', async () => {
      mockBlogCreate.mockResolvedValue({
        ...FULL_BLOG,
        imagem_capa: null,
        imagem_banner: null,
        imagem_banner_mobile: null,
      });

      await blogsService.create({
        titulo: 'Sem imagens',
        descricao: 'desc',
        materia: 'materia',
      });

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imagem_capa: null,
            imagem_banner: null,
            imagem_banner_mobile: null,
          }),
        }),
      );
    });

    it('sets data_publicacao to null when not provided', async () => {
      mockBlogCreate.mockResolvedValue({ ...FULL_BLOG, data_publicacao: null });

      await blogsService.create({
        titulo: 'Sem data',
        descricao: 'desc',
        materia: 'materia',
      });

      const callData = mockBlogCreate.mock.calls[0][0].data;
      expect(callData.data_publicacao).toBeNull();
    });

    it('sets publicado to false for a draft post', async () => {
      mockBlogCreate.mockResolvedValue({ ...FULL_BLOG, publicado: false });

      await blogsService.create({
        titulo: 'Rascunho',
        descricao: 'desc',
        materia: 'materia',
        publicado: false,
      });

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publicado: false }),
        }),
      );
    });
  });

  describe('list / listPublished', () => {
    it('list returns all blogs ordered by createdAt desc', async () => {
      mockBlogFindMany.mockResolvedValue([FULL_BLOG]);

      const result = await blogsService.list();

      expect(mockBlogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(result[0]).toMatchObject({ titulo: 'Artigo de teste', categoria: 'tecnologia' });
    });

    it('listPublished filters by publicado=true', async () => {
      mockBlogFindMany.mockResolvedValue([FULL_BLOG]);

      await blogsService.listPublished(10);

      expect(mockBlogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicado: true },
          take: 10,
        }),
      );
    });

    it('listPublished returns empty array when no published posts exist', async () => {
      mockBlogFindMany.mockResolvedValue([]);

      const result = await blogsService.listPublished();

      expect(result).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('retrieves blog with all fields by id', async () => {
      mockBlogFindUnique.mockResolvedValue(FULL_BLOG);

      const result = await blogsService.getById(1);

      expect(mockBlogFindUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toMatchObject({
        id: 1,
        categoria: 'tecnologia',
        titulo: 'Artigo de teste',
        descricao: 'Descricao curta do artigo',
        materia: '<p>Conteudo completo do artigo</p>',
        imagem_capa: 'https://cdn.example.com/capa.jpg',
        imagem_banner: 'https://cdn.example.com/banner.jpg',
        imagem_banner_mobile: 'https://cdn.example.com/banner-mobile.jpg',
        publicado: true,
      });
    });

    it('returns null for non-existent blog', async () => {
      mockBlogFindUnique.mockResolvedValue(null);

      const result = await blogsService.getById(999);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates titulo, descricao, materia, categoria selectively', async () => {
      const updated = { ...FULL_BLOG, titulo: 'Titulo atualizado', descricao: 'Nova desc' };
      mockBlogUpdate.mockResolvedValue(updated);

      const result = await blogsService.update(1, {
        titulo: 'Titulo atualizado',
        descricao: 'Nova desc',
      });

      expect(mockBlogUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            titulo: 'Titulo atualizado',
            descricao: 'Nova desc',
          }),
        }),
      );
      expect(result.titulo).toBe('Titulo atualizado');
    });

    it('unpublishes a blog post (publicado=false)', async () => {
      mockBlogUpdate.mockResolvedValue({ ...FULL_BLOG, publicado: false });

      await blogsService.update(1, { publicado: false });

      expect(mockBlogUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publicado: false }),
        }),
      );
    });

    it('updates imagem_capa, imagem_banner, imagem_banner_mobile', async () => {
      mockBlogUpdate.mockResolvedValue(FULL_BLOG);

      await blogsService.update(1, {
        imagem_capa: 'https://cdn.example.com/nova-capa.jpg',
        imagem_banner: 'https://cdn.example.com/novo-banner.jpg',
        imagem_banner_mobile: 'https://cdn.example.com/novo-banner-mobile.jpg',
      });

      expect(mockBlogUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imagem_capa: 'https://cdn.example.com/nova-capa.jpg',
            imagem_banner: 'https://cdn.example.com/novo-banner.jpg',
            imagem_banner_mobile: 'https://cdn.example.com/novo-banner-mobile.jpg',
          }),
        }),
      );
    });

    it('updates data_publicacao converting string to Date', async () => {
      mockBlogUpdate.mockResolvedValue(FULL_BLOG);

      await blogsService.update(1, { data_publicacao: '2026-06-01T00:00:00.000Z' });

      const callData = mockBlogUpdate.mock.calls[0][0].data;
      expect(callData.data_publicacao).toBeInstanceOf(Date);
      expect(callData.data_publicacao.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    it('sets data_publicacao to null when explicitly cleared', async () => {
      mockBlogUpdate.mockResolvedValue({ ...FULL_BLOG, data_publicacao: null });

      await blogsService.update(1, { data_publicacao: null });

      const callData = mockBlogUpdate.mock.calls[0][0].data;
      expect(callData.data_publicacao).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes blog by id', async () => {
      mockBlogDelete.mockResolvedValue(FULL_BLOG);

      const result = await blogsService.remove(1);

      expect(mockBlogDelete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.id).toBe(1);
    });
  });
});
