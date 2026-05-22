import { prisma } from '@/shared/infra/prisma';
import { Prisma } from '@/generated/prisma/client';

export interface BlogPayload {
  categoria?: string;
  titulo: string;
  descricao: string;
  materia: string;
  imagem_capa?: string | null;
  imagem_banner?: string | null;
  imagem_banner_mobile?: string | null;
  tempo_leitura?: string | null;
  topicos?: string[] | null;
  publicado?: boolean;
  data_publicacao?: string | null;
}

export const blogsService = {
  async list() {
    return prisma.blog.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async listPublished(perPage = 100) {
    return prisma.blog.findMany({
      where: { publicado: true },
      orderBy: { createdAt: 'desc' },
      take: perPage,
    });
  },

  async getById(id: number) {
    return prisma.blog.findUnique({ where: { id } });
  },

  async create(payload: BlogPayload) {
    const data: Prisma.BlogCreateInput = {
      categoria: payload.categoria ?? '',
      titulo: payload.titulo,
      descricao: payload.descricao,
      materia: payload.materia,
      imagem_capa: payload.imagem_capa ?? null,
      imagem_banner: payload.imagem_banner ?? null,
      imagem_banner_mobile: payload.imagem_banner_mobile ?? null,
      tempo_leitura: payload.tempo_leitura ?? null,
      topicos: payload.topicos != null ? payload.topicos : Prisma.DbNull,
      publicado: payload.publicado ?? true,
      data_publicacao: payload.data_publicacao ? new Date(payload.data_publicacao) : null,
    };
    return prisma.blog.create({ data });
  },

  async update(id: number, payload: Partial<BlogPayload>) {
    const data: Prisma.BlogUpdateInput = {};
    if (payload.categoria !== undefined) data.categoria = payload.categoria;
    if (payload.titulo !== undefined) data.titulo = payload.titulo;
    if (payload.descricao !== undefined) data.descricao = payload.descricao;
    if (payload.materia !== undefined) data.materia = payload.materia;
    if (payload.imagem_capa !== undefined) data.imagem_capa = payload.imagem_capa;
    if (payload.imagem_banner !== undefined) data.imagem_banner = payload.imagem_banner;
    if (payload.imagem_banner_mobile !== undefined) data.imagem_banner_mobile = payload.imagem_banner_mobile;
    if (payload.tempo_leitura !== undefined) data.tempo_leitura = payload.tempo_leitura;
    if (payload.topicos !== undefined) data.topicos = payload.topicos != null ? payload.topicos : Prisma.DbNull;
    if (payload.publicado !== undefined) data.publicado = payload.publicado;
    if (payload.data_publicacao !== undefined) {
      data.data_publicacao = payload.data_publicacao ? new Date(payload.data_publicacao) : null;
    }
    return prisma.blog.update({ where: { id }, data });
  },

  async remove(id: number) {
    return prisma.blog.delete({ where: { id } });
  },
};
