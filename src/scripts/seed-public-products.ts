import 'dotenv/config';
import { prisma } from '@/shared/infra/prisma';

const categories = [
  { title: 'Placas de sinalização', coverImage: '/assets/categorias/placadesinalização.png' },
  { title: 'Tachas e tachões', coverImage: '/assets/categorias/tachas.png' },
  { title: 'Dispositivos refletivos', coverImage: '/assets/categorias/dispositivos.png' },
  { title: 'Tintas para sinalização', coverImage: '/assets/categorias/tintas.png' },
  { title: 'Equipamentos', coverImage: '/assets/categorias/equipamentos.png' },
  { title: 'Kits', coverImage: '/assets/categorias/kits.png' },
];

async function ensureCategory(title: string, coverImage: string) {
  const existing = await prisma.productCategory.findFirst({ where: { title } });
  if (existing) {
    return prisma.productCategory.update({ where: { id: existing.id }, data: { coverImage } });
  }
  return prisma.productCategory.create({ data: { title, coverImage } });
}

const productData = [
  {
    code: 'A1B2C3D4',
    category: 'Equipamentos',
    title: 'Cone rodoviário flexível com base de borracha 75 cm',
    slug: 'cone-rodoviario-flexivel-com-base-de-borracha-75-cm',
    brand: 'Tinpavi',
    badge: 'MAIS VENDIDO',
    pricing: 59.9,
    pix_pricing: 56.9,
    compare_at_price: 69.9,
    weight_kg: 3.2,
    dimensions: '75 x 38 x 38 cm',
    quantity_stock: 42,
    sales: 28,
    reviews: 12,
    carousel_image: ['/assets/maisVendidos/cone.png', '/assets/conteudos/rua.jpeg', '/assets/categorias/kits.png'],
    benefits: 'Altura: 75 cm\nMaterial: PVC flexível\nBase: Borracha pesada\nCor: Laranja com faixas refletivas\nUso: Rodovias, obras, condomínios e estacionamentos',
    specifications: { Altura: '75 cm', Material: 'PVC flexível', Base: 'Borracha pesada', Peso: '3,2 kg', Cor: 'Laranja com faixas refletivas', 'Uso indicado': 'Rodovias, obras, condomínios, estacionamentos e eventos' },
    applications: 'Indicado para sinalização temporária em rodovias, estacionamentos, obras, condomínios e áreas de controle de tráfego.',
    description: 'Cone rodoviário flexível de 75 cm com base pesada para sinalização viária. Oferece boa estabilidade, alta visibilidade e fácil manuseio para uso profissional.',
    faqs: [{ question: 'Esse produto possui faixa refletiva?', answer: 'Sim, possui faixas refletivas para maior visibilidade.' }],
    usage_areas: ['Rodovias', 'Obras', 'Condominios', 'Estacionamentos'],
    variants: [],
    seo_title: 'Cone rodoviário flexível 75 cm',
    seo_description: 'Cone rodoviário flexível de 75 cm com base de borracha pesada.',
    is_featured: true,
    is_active: true,
    where_use: [{ icon: 'road', description: 'Rodovias' }, { icon: 'building', description: 'Obras' }, { icon: 'warehouse', description: 'Estacionamentos' }],
  },
  {
    code: 'B2C3D4E5',
    category: 'Tachas e tachões',
    title: 'Tachão refletivo bidirecional amarelo',
    slug: 'tachao-refletivo-bidirecional-amarelo',
    brand: 'Tinpavi',
    badge: 'MAIS VENDIDO',
    pricing: 28.9,
    pix_pricing: 27.45,
    compare_at_price: 32.9,
    quantity_stock: 120,
    sales: 64,
    reviews: 18,
    carousel_image: ['/assets/maisVendidos/tachão.png', '/assets/categorias/tachas.png'],
    benefits: 'Alta resistência\nRefletivo bidirecional\nFixação firme\nUso em vias, estacionamentos e condomínios',
    specifications: { Material: 'Resina de alta resistência', Cor: 'Amarelo', Reflexão: 'Bidirecional', Fixação: 'Parafusos e cola' },
    applications: 'Utilizado para divisão de pistas, reforço de sinalização horizontal e organização de fluxo em áreas externas.',
    description: 'Tachão refletivo bidirecional amarelo para sinalização de tráfego e delimitação de vias com excelente visibilidade noturna.',
    faqs: [{ question: 'Acompanha fixadores?', answer: 'A fixação pode ser feita com parafusos e cola, conforme o local de aplicação.' }],
    usage_areas: ['Rodovias', 'Estacionamentos', 'Condominios'],
    variants: [],
    is_featured: true,
    is_active: true,
    where_use: [{ icon: 'road', description: 'Vias urbanas' }, { icon: 'parking', description: 'Estacionamentos' }],
  },
  {
    code: 'C3D4E5F6',
    category: 'Placas de sinalização',
    title: 'Placa de sinalização Pare R-1 galvanizada 50 cm',
    slug: 'placa-de-sinalizacao-pare-r-1-galvanizada-50-cm',
    brand: 'Tinpavi',
    badge: 'PRONTA ENTREGA',
    pricing: 89.9,
    pix_pricing: 85.4,
    compare_at_price: 99.9,
    quantity_stock: 36,
    sales: 31,
    reviews: 9,
    carousel_image: ['/assets/maisVendidos/placadesinalização.png', '/assets/categorias/placadesinalização.png'],
    benefits: 'Aço galvanizado\nPelícula refletiva\nDiâmetro 50 cm\nPronta para instalação',
    specifications: { Material: 'Aço galvanizado', Modelo: 'R-1 Pare', Tamanho: '50 cm', Acabamento: 'Refletivo' },
    applications: 'Indicada para vias internas, condomínios, estacionamentos, obras e áreas de controle de tráfego.',
    description: 'Placa Pare R-1 em aço galvanizado com acabamento refletivo para sinalização viária e controle seguro de circulação.',
    faqs: [{ question: 'A placa é refletiva?', answer: 'Sim, possui acabamento refletivo para melhor visibilidade.' }],
    usage_areas: ['Condominios', 'Estacionamentos', 'Empresas'],
    variants: [],
    is_featured: true,
    is_active: true,
    where_use: [{ icon: 'building', description: 'Condomínios' }, { icon: 'parking', description: 'Estacionamentos' }],
  },
  {
    code: 'D4E5F6A7',
    category: 'Tintas para sinalização',
    title: 'Tinta acrílica para sinalização viária 18L',
    slug: 'tinta-acrilica-para-sinalizacao-viaria-18l',
    brand: 'Tinpavi',
    badge: 'USO PROFISSIONAL',
    pricing: 540,
    pix_pricing: 513,
    compare_at_price: 579.9,
    quantity_stock: 18,
    sales: 16,
    reviews: 7,
    carousel_image: ['/assets/maisVendidos/tinta.png', '/assets/categorias/tintas.png'],
    benefits: 'Alta cobertura\nSecagem rápida\nUso profissional\nIndicada para pavimentos',
    specifications: { Volume: '18 L', Tipo: 'Acrílica', Uso: 'Sinalização viária', Rendimento: 'Conforme superfície' },
    applications: 'Aplicação em faixas, demarcações, estacionamentos, condomínios e áreas industriais.',
    description: 'Tinta acrílica para sinalização viária em balde de 18 litros, indicada para demarcação profissional em pavimentos.',
    faqs: [{ question: 'Pode ser usada em asfalto?', answer: 'Sim, é indicada para demarcação viária em pavimentos preparados.' }],
    usage_areas: ['Rodovias', 'Empresas', 'Estacionamentos'],
    variants: [],
    is_featured: true,
    is_active: true,
    where_use: [{ icon: 'road', description: 'Rodovias' }, { icon: 'factory', description: 'Áreas industriais' }],
  },
  {
    code: 'E5F6A7B8',
    category: 'Kits',
    title: 'Kit de sinalização com cones e corrente plástica',
    slug: 'kit-de-sinalizacao-com-cones-e-corrente-plastica',
    brand: 'Tinpavi',
    badge: 'KIT COMPLETO',
    pricing: 329.9,
    pix_pricing: 313.4,
    compare_at_price: 359.9,
    quantity_stock: 24,
    sales: 22,
    reviews: 8,
    carousel_image: ['/assets/categorias/kits.png', '/assets/maisVendidos/cone.png'],
    benefits: 'Kit completo\nFácil montagem\nUso temporário\nAlta visibilidade',
    specifications: { Itens: 'Cones, corrente e elos', Uso: 'Isolamento e organização', Cor: 'Laranja, preto e amarelo' },
    applications: 'Ideal para bloqueios temporários, organização de filas, obras rápidas e controle de acesso.',
    description: 'Kit de sinalização com cones e corrente plástica para isolamento rápido de áreas e organização do fluxo de pessoas ou veículos.',
    faqs: [{ question: 'O kit é indicado para áreas externas?', answer: 'Sim, pode ser usado em obras, eventos e áreas de acesso temporário.' }],
    usage_areas: ['Eventos', 'Obras', 'Empresas'],
    variants: [],
    is_featured: true,
    is_active: true,
    where_use: [{ icon: 'event', description: 'Eventos' }, { icon: 'building', description: 'Obras' }],
  },
  {
    code: 'F6A7B8C9',
    category: 'Dispositivos refletivos',
    title: 'Lombada modular refletiva 50x40x5 cm',
    slug: 'lombada-modular-refletiva-50x40x5-cm',
    brand: 'Tinpavi',
    badge: 'ALTA DURABILIDADE',
    pricing: 74.9,
    pix_pricing: 71.15,
    compare_at_price: 84.9,
    quantity_stock: 55,
    sales: 14,
    reviews: 6,
    carousel_image: ['/assets/maisVendidos/lombadamodular.png', '/assets/categorias/dispositivos.png'],
    benefits: 'Alta durabilidade\nMódulo refletivo\nInstalação simples\nControle de velocidade',
    specifications: { Dimensões: '50 x 40 x 5 cm', Material: 'Borracha', Acabamento: 'Refletivo', Uso: 'Redução de velocidade' },
    applications: 'Indicada para estacionamentos, condomínios, empresas, vias internas e áreas de circulação controlada.',
    description: 'Lombada modular refletiva para controle de velocidade em áreas internas e externas com boa resistência e visibilidade.',
    faqs: [{ question: 'Pode instalar em estacionamento?', answer: 'Sim, é indicada para estacionamentos, condomínios e vias internas.' }],
    usage_areas: ['Estacionamentos', 'Condominios', 'Empresas'],
    variants: [],
    is_featured: true,
    is_active: true,
    where_use: [{ icon: 'parking', description: 'Estacionamentos' }, { icon: 'company', description: 'Empresas' }],
  },
];

async function main() {
  const categoryMap = new Map<string, string>();

  for (const category of categories) {
    const saved = await ensureCategory(category.title, category.coverImage);
    categoryMap.set(category.title, saved.id);
  }

  for (const product of productData) {
    const category_id = categoryMap.get(product.category);
    if (!category_id) throw new Error(`Categoria nao encontrada: ${product.category}`);

    const { category, ...data } = product;
    await prisma.product.upsert({
      where: { code: product.code },
      update: { ...data, category_id, icons: 'package' },
      create: { ...data, category_id, icons: 'package' },
    });
  }

  console.log(`Seed concluido: ${productData.length} produtos e ${categories.length} categorias.`);
}

void main().finally(async () => {
  await prisma.$disconnect();
});
