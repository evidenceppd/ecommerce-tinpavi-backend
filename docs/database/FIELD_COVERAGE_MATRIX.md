# Matriz Completa de Cobertura por Campo

- Origem: `backend-tinpavi/prisma/schema.prisma`
- Metodo: heuristica por ocorrencia de nome de campo em arquivos de teste backend/frontend
- Observacao: esta matriz indica evidencias de cobertura, nao substitui assertions semanticas de fronteira para 100% de confianca

## Resumo

- Campos totais: **149**
- Cobertos: **149**
- Parciais: **0**
- Nao cobertos: **0**
- Risco alto: **77** | medio: **60** | baixo: **12**

## Checklist Prioritario

_Sem itens em aberto de risco alto._

## Matriz por Modelo

### User

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | nao | nao | sim | sim | coberto | alta |
| name | String | sim | nao | nao | sim | sim | coberto | alta |
| email | String | sim | nao | sim | sim | sim | coberto | alta |
| password | String | sim | nao | nao | sim | sim | coberto | alta |
| role | UserRole | sim | sim | nao | sim | sim | coberto | alta |
| firstLogin | Boolean | sim | sim | nao | sim | sim | coberto | alta |
| isActive | Boolean | sim | sim | nao | sim | sim | coberto | alta |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | alta |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | alta |

### UserRefreshToken

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| jti | String | sim | nao | nao | sim | n/a | coberto | alta |
| userId | String | sim | nao | nao | sim | n/a | coberto | alta |
| expiresAt | DateTime | sim | nao | nao | sim | n/a | coberto | alta |
| createdAt | DateTime | sim | sim | nao | sim | n/a | coberto | alta |

### Customer

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | alta |
| email | String | sim | nao | sim | sim | sim | coberto | alta |
| password | String | sim | nao | nao | sim | sim | coberto | alta |
| name | String | sim | nao | nao | sim | sim | coberto | alta |
| phone | String? | nao | nao | nao | sim | sim | coberto | alta |
| role | Role | sim | sim | nao | sim | sim | coberto | alta |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | alta |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | alta |

### Address

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | media |
| customerId | String | sim | nao | nao | sim | sim | coberto | media |
| label | String? | nao | nao | nao | sim | sim | coberto | media |
| zipCode | String | sim | nao | nao | sim | sim | coberto | media |
| street | String | sim | nao | nao | sim | sim | coberto | media |
| number | String | sim | nao | nao | sim | sim | coberto | media |
| complement | String? | nao | nao | nao | sim | sim | coberto | media |
| district | String | sim | nao | nao | sim | sim | coberto | media |
| city | String | sim | nao | nao | sim | sim | coberto | media |
| state | String | sim | nao | nao | sim | sim | coberto | media |
| country | String | sim | sim | nao | sim | sim | coberto | media |
| isDefault | Boolean | sim | sim | nao | sim | sim | coberto | media |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | media |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | media |

### RefreshToken

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| jti | String | sim | nao | nao | sim | n/a | coberto | alta |
| customerId | String | sim | nao | nao | sim | n/a | coberto | alta |
| expiresAt | DateTime | sim | nao | nao | sim | n/a | coberto | alta |
| createdAt | DateTime | sim | sim | nao | sim | n/a | coberto | alta |

### Product

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | media |
| category_id | String | sim | nao | nao | sim | sim | coberto | media |
| code | String | sim | nao | sim | sim | sim | coberto | media |
| title | String | sim | nao | nao | sim | sim | coberto | media |
| description | String | sim | nao | nao | sim | sim | coberto | media |
| specifications | Json | sim | nao | nao | sim | sim | coberto | media |
| applications | String | sim | nao | nao | sim | sim | coberto | media |
| benefits | String | sim | nao | nao | sim | sim | coberto | media |
| where_use | Json | sim | nao | nao | sim | sim | coberto | media |
| carousel_image | Json | sim | nao | nao | sim | sim | coberto | media |
| icons | String | sim | nao | nao | sim | sim | coberto | media |
| pricing | Float | sim | nao | nao | sim | sim | coberto | media |
| pix_pricing | Float | sim | nao | nao | sim | sim | coberto | media |
| quantity_stock | Int | sim | sim | nao | sim | sim | coberto | media |
| reviews | Int | sim | sim | nao | sim | sim | coberto | media |
| sales | Int | sim | sim | nao | sim | sim | coberto | media |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | media |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | media |

### ProductCategory

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | media |
| title | String | sim | nao | nao | sim | sim | coberto | media |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | media |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | media |

### Coupon

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | alta |
| code | String | sim | nao | sim | sim | sim | coberto | alta |
| type | CouponType | sim | nao | nao | sim | sim | coberto | alta |
| value | Decimal | sim | nao | nao | sim | sim | coberto | alta |
| validFrom | DateTime | sim | nao | nao | sim | sim | coberto | alta |
| validUntil | DateTime | sim | nao | nao | sim | sim | coberto | alta |
| maxUses | Int? | nao | nao | nao | sim | sim | coberto | alta |
| maxUsesPerCustomer | Int? | nao | nao | nao | sim | sim | coberto | alta |
| usedCount | Int | sim | sim | nao | sim | sim | coberto | alta |
| isActive | Boolean | sim | sim | nao | sim | sim | coberto | alta |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | alta |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | alta |

### Order

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | alta |
| customerId | String | sim | nao | nao | sim | sim | coberto | alta |
| status | OrderStatus | sim | sim | nao | sim | sim | coberto | alta |
| subtotal | Decimal | sim | nao | nao | sim | sim | coberto | alta |
| shippingCost | Decimal | sim | nao | nao | sim | sim | coberto | alta |
| discountAmount | Decimal | sim | sim | nao | sim | sim | coberto | alta |
| totalAmount | Decimal | sim | nao | nao | sim | sim | coberto | alta |
| couponId | String? | nao | nao | nao | sim | sim | coberto | alta |
| couponCode | String? | nao | nao | nao | sim | sim | coberto | alta |
| shippingStreet | String | sim | nao | nao | sim | sim | coberto | alta |
| shippingNumber | String | sim | nao | nao | sim | sim | coberto | alta |
| shippingComplement | String? | nao | nao | nao | sim | sim | coberto | alta |
| shippingNeighborhood | String | sim | nao | nao | sim | sim | coberto | alta |
| shippingCity | String | sim | nao | nao | sim | sim | coberto | alta |
| shippingState | String | sim | nao | nao | sim | sim | coberto | alta |
| shippingZipCode | String | sim | nao | nao | sim | sim | coberto | alta |
| shippingAddressRef | String? | nao | nao | nao | sim | sim | coberto | alta |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | alta |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | alta |
| paymentMethod | String? | nao | nao | nao | sim | sim | coberto | alta |
| paymentStatus | PaymentStatus | sim | sim | nao | sim | sim | coberto | alta |
| paymentExternalId | String? | nao | nao | nao | sim | sim | coberto | alta |
| paidAt | DateTime? | nao | nao | nao | sim | sim | coberto | alta |

### OrderItem

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | alta |
| orderId | String | sim | nao | nao | sim | sim | coberto | alta |
| productId | String | sim | nao | nao | sim | sim | coberto | alta |
| variantId | String? | nao | nao | nao | sim | sim | coberto | alta |
| quantity | Int | sim | nao | nao | sim | sim | coberto | alta |
| unitPrice | Decimal | sim | nao | nao | sim | sim | coberto | alta |
| totalPrice | Decimal | sim | nao | nao | sim | sim | coberto | alta |

### OrderStatusHistory

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | n/a | coberto | alta |
| orderId | String | sim | nao | nao | sim | n/a | coberto | alta |
| status | OrderStatus | sim | nao | nao | sim | n/a | coberto | alta |
| changedAt | DateTime | sim | sim | nao | sim | n/a | coberto | alta |
| changedBy | String? | nao | nao | nao | sim | n/a | coberto | alta |

### Review

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | media |
| customerId | String | sim | nao | nao | sim | sim | coberto | media |
| productId | String | sim | nao | nao | sim | sim | coberto | media |
| rating | Int | sim | nao | nao | sim | sim | coberto | media |
| comment | String? | nao | nao | nao | sim | sim | coberto | media |
| status | ReviewStatus | sim | sim | nao | sim | sim | coberto | media |
| isVerifiedPurchase | Boolean | sim | sim | nao | sim | sim | coberto | media |
| moderatedBy | String? | nao | nao | nao | sim | sim | coberto | media |
| moderatedAt | DateTime? | nao | nao | nao | sim | sim | coberto | media |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | media |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | media |

### Redirect

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | sim | coberto | media |
| fromPath | String | sim | nao | sim | sim | sim | coberto | media |
| toPath | String | sim | nao | nao | sim | sim | coberto | media |
| isActive | Boolean | sim | sim | nao | sim | sim | coberto | media |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | media |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | media |

### PaymentWebhookEvent

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | String | sim | sim | nao | sim | n/a | coberto | alta |
| eventKey | String | sim | nao | sim | sim | n/a | coberto | alta |
| externalId | String | sim | nao | nao | sim | n/a | coberto | alta |
| status | String | sim | nao | nao | sim | n/a | coberto | alta |
| processedAt | DateTime | sim | sim | nao | sim | n/a | coberto | alta |

### PageView

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | Int | sim | sim | nao | sim | n/a | coberto | media |
| page | String | sim | nao | nao | sim | n/a | coberto | media |
| title | String? | nao | nao | nao | sim | n/a | coberto | media |
| device | String | sim | sim | nao | sim | n/a | coberto | media |
| referrer | String? | nao | nao | nao | sim | n/a | coberto | media |
| sessionId | String? | nao | nao | nao | sim | n/a | coberto | media |
| createdAt | DateTime | sim | sim | nao | sim | n/a | coberto | media |

### Blog

| Campo | Tipo | Obrigatorio | Default | Unique | Backend test hit | Frontend test hit | Status | Risco |
|---|---|---|---|---|---|---|---|---|
| id | Int | sim | sim | nao | sim | sim | coberto | baixa |
| categoria | String | sim | sim | nao | sim | sim | coberto | baixa |
| titulo | String | sim | nao | nao | sim | sim | coberto | baixa |
| descricao | String | sim | nao | nao | sim | sim | coberto | baixa |
| materia | String | sim | nao | nao | sim | sim | coberto | baixa |
| imagem_capa | String? | nao | nao | nao | sim | sim | coberto | baixa |
| imagem_banner | String? | nao | nao | nao | sim | sim | coberto | baixa |
| imagem_banner_mobile | String? | nao | nao | nao | sim | sim | coberto | baixa |
| publicado | Boolean | sim | sim | nao | sim | sim | coberto | baixa |
| data_publicacao | DateTime? | nao | nao | nao | sim | sim | coberto | baixa |
| createdAt | DateTime | sim | sim | nao | sim | sim | coberto | baixa |
| updatedAt | DateTime | sim | nao | nao | sim | sim | coberto | baixa |

## Proximos Passos Objetivos

Cobertura total atingida (100%). Nenhuma acao pendente.