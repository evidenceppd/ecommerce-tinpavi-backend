# Documentação Completa do Banco de Dados - E-commerce TinPavi

## Índice de Tabelas

1. [User](#user) - Usuários administrativos
2. [UserRefreshToken](#userrefreshtoken) - Tokens de refresh para admins
3. [Customer](#customer) - Clientes do e-commerce
4. [Address](#address) - Endereços dos clientes
5. [RefreshToken](#refreshtoken) - Tokens de refresh para clientes
6. [Product](#product) - Produtos do catálogo
7. [ProductCategory](#productcategory) - Categorias de produtos
8. [Coupon](#coupon) - Cupons/promoções
9. [Order](#order) - Pedidos dos clientes
10. [OrderItem](#orderitem) - Itens de um pedido
11. [OrderStatusHistory](#orderstatushistory) - Histórico de status dos pedidos
12. [Review](#review) - Avaliações de produtos
13. [Redirect](#redirect) - Redirecionamentos de URLs
14. [PaymentWebhookEvent](#paymentwebhookevent) - Eventos de webhook de pagamento
15. [PageView](#pageview) - Visualizações de páginas
16. [Blog](#blog) - Artigos/Notícias

---

## User

**Descrição:** Tabela de usuários administrativos do sistema.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String | - | Identificador único (manual) |
| `name` | String | - | Nome completo do usuário |
| `email` | String (UNIQUE) | - | Email único para login |
| `password` | String | - | Senha criptografada (bcrypt) |
| `role` | Enum | `EDITOR` | Papel do usuário (EDITOR, ADMIN, MASTER) |
| `firstLogin` | Boolean | `false` | Indica se é primeiro acesso |
| `isActive` | Boolean | `true` | Se o usuário está ativo |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Relacionamentos
- ← `UserRefreshToken` (1:N) - Tokens de refresh associados

### Observações
- Sem CUID - ID é gerado externamente
- Roles: EDITOR (padrão), ADMIN, MASTER
- Campo `password` já é hash bcrypt

---

## UserRefreshToken

**Descrição:** Armazena tokens de refresh para usuários administrativos.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `jti` | String | - | JWT ID (Identificador único do token) |
| `userId` | String | - | Referência ao User |
| `expiresAt` | DateTime | - | Data de expiração do token |
| `createdAt` | DateTime | `now()` | Data de criação |

### Relacionamentos
- → `User` (N:1) - Usuário proprietário do token

### Observações
- `jti` é a chave primária (segue padrão JWT)
- Permite logout server-side através da invalidação de tokens

---

## Customer

**Descrição:** Clientes/Usuários do e-commerce que fazem compras.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `email` | String (UNIQUE) | - | Email único do cliente |
| `password` | String | - | Senha criptografada (bcrypt) |
| `name` | String | - | Nome do cliente |
| `phone` | String | NULL | Telefone de contato |
| `role` | Enum | `CUSTOMER` | Papel (CUSTOMER, ADMIN, MASTER) |
| `createdAt` | DateTime | `now()` | Data de cadastro |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Índices
- `idx_customer_created_at` - Otimiza buscas por data

### Relacionamentos
- ← `Address` (1:N) - Endereços do cliente
- ← `Order` (1:N) - Pedidos do cliente
- ← `Review` (1:N) - Avaliações do cliente
- ← `RefreshToken` (1:N) - Tokens de refresh

### Observações
- Suporta múltiplos papéis (para admins que também são clientes)
- Email é único para evitar duplicatas

---

## Address

**Descrição:** Endereços de entrega dos clientes.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `customerId` | String | - | Referência ao Customer |
| `label` | String | NULL | Rótulo do endereço (ex: Casa, Escritório) |
| `zipCode` | String | - | CEP do endereço |
| `street` | String | - | Nome da rua |
| `number` | String | - | Número |
| `complement` | String | NULL | Complemento (apto, bloco, etc) |
| `district` | String | - | Bairro |
| `city` | String | - | Cidade |
| `state` | String | - | Estado/UF |
| `country` | String | `BR` | País |
| `isDefault` | Boolean | `false` | Se é endereço padrão |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Relacionamentos
- → `Customer` (N:1) - Cliente proprietário

### Observações
- Um cliente pode ter múltiplos endereços
- `isDefault` facilita seleção na checkout
- Cascata delete: deletar customer remove todos os endereços

---

## RefreshToken

**Descrição:** Tokens de refresh para clientes (customers).

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `jti` | String | - | JWT ID (Identificador único) |
| `customerId` | String | - | Referência ao Customer |
| `expiresAt` | DateTime | - | Data de expiração |
| `createdAt` | DateTime | `now()` | Data de criação |

### Relacionamentos
- → `Customer` (N:1) - Cliente proprietário

### Observações
- Mesma lógica de UserRefreshToken mas para clientes
- Permite logout server-side

---

## Product

**Descrição:** Produtos do catálogo de e-commerce.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `category_id` | String | - | Referência à categoria (FK) |
| `code` | String (8 chars) | - | SKU único do produto |
| `title` | String | - | Nome do produto |
| `description` | Text | - | Descrição longa |
| `specifications` | JSON | - | Especificações técnicas |
| `applications` | String | - | Aplicações/usos |
| `benefits` | String | - | Benefícios |
| `where_use` | JSON | - | Onde usar |
| `carousel_image` | JSON | - | URLs das imagens |
| `icons` | String | - | Tags/ícones |
| `pricing` | Float | - | Preço normal |
| `pix_pricing` | Float | - | Preço com desconto PIX |
| `quantity_stock` | Int | `0` | Quantidade em estoque |
| `reviews` | Int | `0` | Número de avaliações |
| `sales` | Int | `0` | Número de vendas |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Índices
- `idx_product_category_id` - Buscas por categoria
- `idx_product_title` - Buscas por nome
- `idx_product_created_at` - Ordenação por data

### Relacionamentos
- → `ProductCategory` (N:1) - Categoria do produto
- ← `OrderItem` (1:N) - Itens de pedidos
- ← `Review` (1:N) - Avaliações

### Observações
- `code` é SKU (Stock Keeping Unit)
- Suporta pricing diferenciado para PIX
- Cascata: deletar categoria não deleta produtos (Restrict)

---

## ProductCategory

**Descrição:** Categorias/Classificação de produtos.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `title` | String | - | Nome da categoria |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Índices
- `idx_product_category_title` - Buscas por nome

### Relacionamentos
- ← `Product` (1:N) - Produtos na categoria

### Observações
- Simples e hierárquica
- Suporta classificação de produtos

---

## Coupon

**Descrição:** Cupons/Promoções aplicáveis a pedidos.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `code` | String (UNIQUE) | - | Código do cupom (ex: PROMO2024) |
| `type` | Enum | - | Tipo (PERCENTAGE ou FIXED) |
| `value` | Decimal(10,2) | - | Valor do desconto |
| `validFrom` | DateTime | - | Data inicial de validade |
| `validUntil` | DateTime | - | Data final de validade |
| `maxUses` | Int | NULL | Máximo de usos totais |
| `maxUsesPerCustomer` | Int | NULL | Máximo de usos por cliente |
| `usedCount` | Int | `0` | Quantidade de vezes usado |
| `isActive` | Boolean | `true` | Se o cupom está ativo |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Relacionamentos
- ← `Order` (1:N) - Pedidos com este cupom

### Observações
- PERCENTAGE: desconto em % | FIXED: desconto fixo em R$
- `code` é único para geração de cupons válidos
- Suporte a limites globais e por cliente

---

## Order

**Descrição:** Pedidos de compra dos clientes.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `customerId` | String | - | Referência ao Customer |
| `status` | Enum | `PENDING_PAYMENT` | Status do pedido |
| `subtotal` | Decimal(10,2) | - | Subtotal (sem frete) |
| `shippingCost` | Decimal(10,2) | - | Custo de frete |
| `discountAmount` | Decimal(10,2) | `0` | Desconto aplicado |
| `totalAmount` | Decimal(10,2) | - | Total final |
| `couponId` | String | NULL | Referência ao cupom usado |
| `couponCode` | String | NULL | Código do cupom (snapshot) |
| `shippingStreet` | String | - | Rua de entrega |
| `shippingNumber` | String | - | Número |
| `shippingComplement` | String | NULL | Complemento |
| `shippingNeighborhood` | String | - | Bairro |
| `shippingCity` | String | - | Cidade |
| `shippingState` | String | - | Estado |
| `shippingZipCode` | String | - | CEP |
| `shippingAddressRef` | String | NULL | Referência a endereço salvo |
| `paymentMethod` | String | NULL | Método de pagamento |
| `paymentStatus` | Enum | `PENDING` | Status do pagamento |
| `paymentExternalId` | String | NULL | ID externo do pagamento |
| `paidAt` | DateTime | NULL | Data do pagamento confirmado |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Índices
- `idx_order_customer_status_created` - Busca por cliente/status/data
- `idx_order_customer_created` - Busca por cliente/data
- `idx_order_status_created` - Busca por status/data

### Relacionamentos
- → `Customer` (N:1) - Cliente do pedido
- → `Coupon` (N:1) - Cupom aplicado (opcional)
- ← `OrderItem` (1:N) - Itens do pedido
- ← `OrderStatusHistory` (1:N) - Histórico de status

### Status Disponíveis
- `PENDING_PAYMENT` - Aguardando pagamento
- `PAID` - Pagamento confirmado
- `SHIPPED` - Enviado
- `DELIVERED` - Entregue
- `CANCELLED` - Cancelado
- `REFUNDED` - Reembolsado

### Observações
- Endereço armazenado "snapshot" para histórico
- Suporte a múltiplos métodos de pagamento
- Integração com webhooks de pagamento

---

## OrderItem

**Descrição:** Itens individuais dentro de um pedido.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `orderId` | String | - | Referência ao Order |
| `productId` | String | - | Referência ao Product |
| `variantId` | String | NULL | ID da variante (opcional) |
| `quantity` | Int | - | Quantidade pedida |
| `unitPrice` | Decimal(10,2) | - | Preço unitário no momento |
| `totalPrice` | Decimal(10,2) | - | Preço total (quantity × unitPrice) |

### Relacionamentos
- → `Order` (N:1) - Pedido proprietário
- → `Product` (N:1) - Produto pedido

### Observações
- Armazena preço "snapshot" no momento do pedido
- Suporte a variantes (cores, tamanhos, etc)
- Cascata: deletar pedido remove itens

---

## OrderStatusHistory

**Descrição:** Registro histórico de mudanças de status de pedidos.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `orderId` | String | - | Referência ao Order |
| `status` | Enum | - | Novo status |
| `changedAt` | DateTime | `now()` | Data da mudança |
| `changedBy` | String | NULL | ID de quem fez a mudança |

### Relacionamentos
- → `Order` (N:1) - Pedido monitorado

### Observações
- Cria auditoria de mudanças de status
- Cascata: deletar pedido remove histórico
- Permite rastrear timeline do pedido

---

## Review

**Descrição:** Avaliações e comentários sobre produtos.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `customerId` | String | - | Referência ao Customer |
| `productId` | String | - | Referência ao Product |
| `rating` | Int | - | Nota (1-5) |
| `comment` | Text | NULL | Comentário/texto da avaliação |
| `status` | Enum | `PENDING` | Status (PENDING, APPROVED, REJECTED) |
| `isVerifiedPurchase` | Boolean | `false` | Se o cliente comprou o produto |
| `moderatedBy` | String | NULL | ID do moderador |
| `moderatedAt` | DateTime | NULL | Data da moderação |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Índices
- `idx_review_product_status_created` - Busca aprovadas por produto
- `idx_review_customer_created` - Histórico do cliente

### Constraints
- UNIQUE(customerId, productId) - Um cliente avalia cada produto apenas 1x

### Relacionamentos
- → `Customer` (N:1) - Cliente que fez a avaliação
- → `Product` (N:1) - Produto avaliado

### Status Disponíveis
- `PENDING` - Aguardando moderação
- `APPROVED` - Aprovada e visível
- `REJECTED` - Rejeitada

### Observações
- Suporte a moderação manual
- Flag de compra verificada
- Ratings 1-5 (inteiros)

---

## Redirect

**Descrição:** Redirecionamentos de URLs (importante para SEO).

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `fromPath` | String (UNIQUE) | - | Caminho de origem |
| `toPath` | String | - | Caminho de destino |
| `isActive` | Boolean | `true` | Se está ativo |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Observações
- Implementa redirecionamentos 301 (movido permanentemente)
- Suporta migração de URLs antigas
- Importante para SEO e backlinks

---

## PaymentWebhookEvent

**Descrição:** Registro de eventos de webhook de provedores de pagamento.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | String (CUID) | Auto | Identificador único |
| `eventKey` | String (UNIQUE) | - | Chave única do evento |
| `externalId` | String | - | ID externo (do provedor) |
| `status` | String | - | Status do evento |
| `processedAt` | DateTime | `now()` | Data do processamento |

### Observações
- Previne duplicate webhooks
- Registra eventos de pagamento
- `eventKey` garante idempotência

---

## PageView

**Descrição:** Rastreamento de visualizações de páginas para analytics.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | Int | Auto | Identificador único |
| `page` | String | - | URL/rota da página |
| `title` | String | NULL | Título da página |
| `device` | String | `unknown` | Tipo de dispositivo |
| `referrer` | String | NULL | URL de referência |
| `sessionId` | String | NULL | ID da sessão do usuário |
| `createdAt` | DateTime | `now()` | Data de visualização |

### Índices
- Índice em `createdAt` - Ordenação temporal
- Índice em `page` - Busca por página

### Observações
- Simples analytics de tráfego
- Rastreamento de device (desktop, mobile, tablet)
- Suporte a sessões

---

## Blog

**Descrição:** Artigos/Notícias e conteúdo editorial.

### Campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `id` | Int | Auto | Identificador único |
| `categoria` | String | `""` | Categoria/tema |
| `titulo` | String | - | Título do artigo |
| `descricao` | Text | - | Descrição/sumário |
| `materia` | Text | - | Conteúdo completo |
| `imagem_capa` | String | NULL | URL da imagem de capa |
| `imagem_banner` | String | NULL | URL do banner desktop |
| `imagem_banner_mobile` | String | NULL | URL do banner mobile |
| `publicado` | Boolean | `true` | Se está publicado |
| `data_publicacao` | DateTime | NULL | Data de publicação |
| `createdAt` | DateTime | `now()` | Data de criação |
| `updatedAt` | DateTime | Auto | Data da última atualização |

### Índices
- Índice em `publicado` - Buscas de artigos publicados
- Índice em `createdAt` - Ordenação por data

### Observações
- Suporta rascunhos (publicado = false)
- Imagens separadas para desktop e mobile
- Categoria é string simples (sem FK)

---

## Enums (Tipos)

### Role
- `CUSTOMER` - Cliente regular
- `ADMIN` - Administrador
- `MASTER` - Super admin

### UserRole
- `EDITOR` - Usuário que edita conteúdo
- `ADMIN` - Administrador
- `MASTER` - Super admin

### OrderStatus
- `PENDING_PAYMENT` - Aguardando pagamento
- `PAID` - Pago
- `SHIPPED` - Enviado
- `DELIVERED` - Entregue
- `CANCELLED` - Cancelado
- `REFUNDED` - Reembolsado

### CouponType
- `PERCENTAGE` - Desconto percentual
- `FIXED` - Desconto fixo

### PaymentStatus
- `PENDING` - Pendente
- `AWAITING_PAYMENT` - Aguardando confirmação
- `PAID` - Pago
- `FAILED` - Falha
- `REFUNDED` - Reembolsado
- `CANCELLED` - Cancelado

### ReviewStatus
- `PENDING` - Aguardando moderação
- `APPROVED` - Aprovada
- `REJECTED` - Rejeitada

---

## Fluxos Principais

### Fluxo de Compra
```
Customer → Address (entrega) → Order 
         → OrderItem (multiplos)
         → Product (referência)
         → Coupon (opcional)
         → OrderStatusHistory (rastreamento)
```

### Fluxo de Avaliação
```
Customer → Review → Product
         (com IsVerifiedPurchase)
         (com Status de moderação)
```

### Fluxo de Autenticação
```
User/Customer → RefreshToken/UserRefreshToken
              → Login com JWT
              → Logout invalidando token
```

### Fluxo de Pagamento
```
Order → PaymentWebhookEvent
      → OrderStatusHistory
      → paidAt timestamp
```

---

**Versão:** 1.0  
**Última atualização:** 11 de maio de 2026  
**Banco de dados:** MySQL
