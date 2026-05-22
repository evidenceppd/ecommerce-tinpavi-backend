# Documentação da Tabela Products

## Visão Geral

A tabela `products` armazena informações sobre os produtos disponíveis no catálogo de e-commerce. Cada produto contém detalhes como categoria, preços, estoque, especificações técnicas e informações de marketing.

**Banco de dados:** MySQL  
**Relacionado com:** `ProductCategory`, `OrderItem`, `Review`

---

## Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto-gerado | Identificador único do produto |
| `category_id` | String | - | ID da categoria do produto (FK) |
| `code` | String (8 caracteres) | - | Código único do produto (SKU) |
| `title` | String | - | Nome/título do produto |
| `description` | Text | - | Descrição detalhada do produto |
| `specifications` | JSON | - | Especificações técnicas em formato JSON |
| `applications` | String | - | Aplicações/usos do produto |
| `benefits` | String | - | Benefícios do produto |
| `where_use` | JSON | - | Onde usar o produto (JSON) |
| `carousel_image` | JSON | - | URLs das imagens do carrossel (JSON) |
| `icons` | String | - | Ícones/tags do produto |
| `pricing` | Float | - | Preço padrão do produto |
| `pix_pricing` | Float | - | Preço especial para pagamento via PIX |
| `quantity_stock` | Integer | `0` | Quantidade em estoque |
| `reviews` | Integer | `0` | Número total de avaliações |
| `sales` | Integer | `0` | Número de vendas realizadas |
| `createdAt` | DateTime | `now()` | Data e hora de criação |
| `updatedAt` | DateTime | Auto | Data e hora da última atualização |

---

## Detalhamento dos Campos Principais

### `id`
- **Tipo:** String (CUID)
- **Chave Primária:** Sim
- **Descrição:** Identificador único gerado automaticamente (CUID - Collision-resistant IDs)
- **Exemplo:** `clp4xk9z70000qz8h5z8x3c8p`

### `category_id`
- **Tipo:** String
- **Relacionamento:** Chave estrangeira → `ProductCategory.id`
- **Restrição:** `onDelete: Restrict` (não permite deletar categoria com produtos)
- **Índice:** `idx_product_category_id`
- **Descrição:** Identifica a categoria do produto

### `code`
- **Tipo:** String (VarChar 8)
- **Unique:** Sim
- **Descrição:** Código único do produto (SKU - Stock Keeping Unit)
- **Exemplo:** `PROD0001`
- **Validação:** Máximo 8 caracteres

### `title`
- **Tipo:** String
- **Índice:** `idx_product_title`
- **Descrição:** Nome comercial do produto
- **Exemplo:** `Tinta Acrílica Premium 1L`

### `description`
- **Tipo:** Text (até 65.535 caracteres)
- **Descrição:** Descrição detalhada e longa do produto
- **Uso:** Informações técnicas, modo de uso, precauções

### `specifications`
- **Tipo:** JSON
- **Descrição:** Especificações técnicas do produto em formato JSON
- **Exemplo:**
```json
{
  "volume": "1L",
  "acabamento": "Brilhante",
  "tempo_secagem": "2h",
  "cobertura": "12-15 m²/L"
}
```

### `applications`
- **Tipo:** String
- **Descrição:** Campo de aplicações/usos recomendados
- **Exemplo:** `Uso interno, Uso externo, Pisos de alto tráfego`

### `benefits`
- **Tipo:** String
- **Descrição:** Benefícios e vantagens do produto
- **Exemplo:** `Resistente à umidade, Secagem rápida, Durável`

### `where_use`
- **Tipo:** JSON
- **Descrição:** Locais/ambientes onde o produto pode ser usado
- **Exemplo:**
```json
{
  "ambientes": ["cozinha", "banheiro", "sala"],
  "tipos_superficie": ["cerâmica", "porcelato", "concreto"]
}
```

### `carousel_image`
- **Tipo:** JSON
- **Descrição:** Array de URLs das imagens do carrossel do produto
- **Exemplo:**
```json
{
  "images": [
    "https://cdn.example.com/products/img1.jpg",
    "https://cdn.example.com/products/img2.jpg",
    "https://cdn.example.com/products/img3.jpg"
  ]
}
```

### `icons`
- **Tipo:** String
- **Descrição:** Tags/ícones de características (ex: eco-friendly, promoção)
- **Exemplo:** `eco-friendly,promoção,bestseller`

### `pricing`
- **Tipo:** Float
- **Descrição:** Preço padrão de venda do produto
- **Exemplo:** `45.90`

### `pix_pricing`
- **Tipo:** Float
- **Descrição:** Preço com desconto para pagamento via PIX
- **Exemplo:** `42.50`
- **Observação:** Geralmente menor que `pricing`

### `quantity_stock`
- **Tipo:** Integer
- **Padrão:** `0`
- **Descrição:** Quantidade disponível em estoque
- **Nota:** Controlado por sistema de inventário

### `reviews`
- **Tipo:** Integer
- **Padrão:** `0`
- **Descrição:** Número total de avaliações/comentários do produto
- **Atualização:** Incrementado automaticamente

### `sales`
- **Tipo:** Integer
- **Padrão:** `0`
- **Descrição:** Contador de vendas realizadas
- **Atualização:** Incrementado quando pedido é completado

### `createdAt`
- **Tipo:** DateTime
- **Padrão:** `now()`
- **Descrição:** Data e hora de criação do registro
- **Índice:** `idx_product_created_at`

### `updatedAt`
- **Tipo:** DateTime
- **Atualização:** Automática
- **Descrição:** Data e hora da última modificação

---

## Índices

Para otimizar queries, existem os seguintes índices:

| Nome do Índice | Campos | Propósito |
|---|---|---|
| `idx_product_category_id` | `category_id` | Busca por categoria |
| `idx_product_title` | `title` | Busca por nome do produto |
| `idx_product_created_at` | `createdAt` | Ordenação por data |

---

## Relacionamentos

### Com ProductCategory (1:N)
```
Product.category_id → ProductCategory.id
```
- Um categoria pode ter vários produtos
- Restrição: Não permite deletar categoria com produtos ativos

### Com OrderItem (1:N)
```
Product.id ← OrderItem.productId
```
- Um produto pode estar em vários itens de pedido

### Com Review (1:N)
```
Product.id ← Review.productId
```
- Um produto pode ter várias avaliações

---

## Exemplos de Queries

### Buscar produto por categoria
```sql
SELECT * FROM Product 
WHERE category_id = 'cat_123' 
ORDER BY createdAt DESC;
```

### Produtos com baixo estoque
```sql
SELECT id, title, quantity_stock, pricing 
FROM Product 
WHERE quantity_stock < 10 
ORDER BY quantity_stock ASC;
```

### Produtos mais vendidos
```sql
SELECT id, title, sales, reviews, pricing 
FROM Product 
ORDER BY sales DESC 
LIMIT 10;
```

### Buscar por nome
```sql
SELECT * FROM Product 
WHERE title LIKE '%tinta%' 
ORDER BY sales DESC;
```

### Comparar preços (PIX vs Normal)
```sql
SELECT id, title, pricing, pix_pricing, 
       (pricing - pix_pricing) as desconto 
FROM Product 
WHERE pix_pricing < pricing;
```

---

## Validações e Regras

1. **Código (code):** Deve ser único e máximo 8 caracteres
2. **Categoria:** Obrigatória, deve existir em `ProductCategory`
3. **Preços:** Devem ser valores positivos
4. **PIX Pricing:** Geralmente menor que pricing (por convenção)
5. **Estoque:** Deve ser >= 0
6. **Avaliações e Vendas:** Contadores automáticos, nunca devem ser negativos

---

## Boas Práticas

- ✅ Sempre validar `category_id` antes de inserir
- ✅ Manter `quantity_stock` atualizado com sistema de inventário
- ✅ Usar `code` como identificador externo (API)
- ✅ Armazenar dados JSON estruturados em `specifications`, `where_use`
- ✅ Indexar buscas frequentes (já feito com `idx_product_title`)
- ✅ Usar `pix_pricing` para promover pagamentos via PIX

---

## Estrutura JSON Recomendada

### Specifications
```json
{
  "dimensoes": {
    "altura": "10cm",
    "largura": "5cm",
    "profundidade": "5cm"
  },
  "peso": "500g",
  "material": "Acrílico",
  "certificacoes": ["ISO 9001", "CE"]
}
```

### Where Use
```json
{
  "ambientes": ["cozinha", "banheiro", "sala"],
  "tipos_superficie": ["azulejo", "porcelato"],
  "clima": ["úmido", "seco"]
}
```

### Carousel Image
```json
{
  "principal": "https://cdn.example.com/prod/main.jpg",
  "imagens": [
    "https://cdn.example.com/prod/img1.jpg",
    "https://cdn.example.com/prod/img2.jpg"
  ],
  "thumbnail": "https://cdn.example.com/prod/thumb.jpg"
}
```

---

## Schema Prisma Original

```prisma
model Product {
  id             String          @id @default(cuid())
  category_id    String
  code           String          @unique @db.VarChar(8)
  title          String
  description    String          @db.Text
  specifications Json
  applications   String
  benefits       String
  where_use      Json
  carousel_image Json
  icons          String
  pricing        Float
  pix_pricing    Float
  quantity_stock Int             @default(0)
  reviews        Int             @default(0)
  sales          Int             @default(0)
  updatedAt      DateTime        @updatedAt
  createdAt      DateTime        @default(now())
  category       ProductCategory @relation(fields: [category_id], references: [id], onDelete: Restrict)
  orderItems     OrderItem[]
  reviewsList    Review[]        @relation("ProductReviews")

  @@index([category_id], map: "idx_product_category_id")
  @@index([title], map: "idx_product_title")
  @@index([createdAt], map: "idx_product_created_at")
}
```

---

**Última atualização:** 11 de maio de 2026  
**Versão:** 1.0
