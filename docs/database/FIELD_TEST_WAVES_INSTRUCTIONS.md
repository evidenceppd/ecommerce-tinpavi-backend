# Instructions de Execucao por Ondas de Teste de Campos

## Objetivo
Este documento define como executar a validacao de campos em ondas, da maior criticidade para a menor, com rastreabilidade e criterios claros de aceite.

Base de controle:
- Matriz de cobertura: `backend-tinpavi/docs/database/FIELD_COVERAGE_MATRIX.md`
- Schema fonte: `backend-tinpavi/prisma/schema.prisma`

---

## Visao Geral das Ondas

### Onda A - Alto Risco
Foco em seguranca, autenticacao, pagamentos e pedidos.

Modelos:
- User
- UserRefreshToken
- RefreshToken
- Customer
- Coupon
- Order
- OrderItem
- OrderStatusHistory
- PaymentWebhookEvent

### Onda B - Medio Risco
Foco em catalogo, conteudo transacional complementar e analytics operacional.

Modelos:
- Product
- ProductCategory
- Review
- Address
- Redirect
- PageView

### Onda C - Baixo Risco
Foco em campos residuais de baixa criticidade.

Modelos:
- Blog
- quaisquer pendencias remanescentes da matriz

---

## Regras Obrigatorias para Todas as Ondas

1. Cada campo deve ter pelo menos:
- 1 caso positivo
- 1 caso negativo
- 1 caso de fronteira (quando aplicavel)

2. Campos marcados como `nao_coberto` na matriz sao prioridade dentro da onda.

3. Nao avancar para a onda seguinte sem cumprir o gate de saida da onda atual.

4. Sempre executar testes por modulo antes da suite completa.

5. Toda alteracao deve refletir na matriz de cobertura e no resumo da onda.

---

## Definicao de Pronto por Campo

Um campo e considerado pronto quando atende todos os itens abaixo:
- Cobertura backend aplicavel validada
- Cobertura frontend aplicavel validada
- Caso positivo validado
- Caso negativo validado
- Caso de fronteira validado (ou justificativa tecnica documentada de nao aplicavel)
- Status atualizado na matriz

---

## Fluxo de Execucao de Cada Onda

### Passo 1: Preparacao

1. Ler a matriz e extrair somente os itens da onda atual.
2. Ordenar por status:
- primeiro `nao_coberto`
- depois `parcial`
3. Ordenar por impacto funcional no dominio.

### Passo 2: Planejamento por Campo

Para cada campo, registrar:
- regra esperada
- onde validar (backend, frontend, db)
- arquivo de teste alvo
- cenarios (positivo, negativo, fronteira)

Template rapido por campo:
- Modelo.Campo:
  - Regra:
  - Camadas:
  - Teste positivo:
  - Teste negativo:
  - Teste fronteira:
  - Arquivo alvo:

### Passo 3: Implementacao

1. Criar/ajustar testes por modulo.
2. Validar localmente o modulo alterado.
3. Repetir para o proximo campo.

### Passo 4: Validacao da Onda

Executar:
- Backend: `cd backend-tinpavi && npm test`
- Frontend: `cd frontend-tinpavi && npm test`

### Passo 5: Evidencias

Atualizar:
- `backend-tinpavi/docs/database/FIELD_COVERAGE_MATRIX.md`
- resumo de onda com:
  - total de campos da onda
  - quantos foram fechados
  - quantos ficaram parciais
  - bloqueios

---

## Gates de Entrada e Saida por Onda

### Gate de Entrada (qualquer onda)

- Matriz atualizada disponivel
- Suite baseline em estado green
- Lista de campos alvo fechada para a onda

### Gate de Saida Onda A

- Nenhum campo de alto risco em `nao_coberto`
- Campos de alto risco com casos positivo e negativo obrigatorios
- Suite backend e frontend green

### Gate de Saida Onda B

- Nenhum campo de medio risco em `nao_coberto`
- Fronteiras numericas e opcionais validadas
- Suite backend e frontend green

### Gate de Saida Onda C

- Zero campos `nao_coberto` na matriz
- Pendencias com justificativa formal (se houver)
- Suite backend e frontend green

---

## Ordem Recomendada de Modulos (Para Reduzir Risco)

### Onda A
1. Auth (User, RefreshToken, UserRefreshToken, Customer)
2. Orders e Coupons (Order, OrderItem, OrderStatusHistory, Coupon)
3. Payments (PaymentWebhookEvent)

### Onda B
1. Catalog e Categories (Product, ProductCategory)
2. Reviews e Customers/Address
3. SEO e Analytics (Redirect, PageView)

### Onda C
1. Blog
2. Residuais da matriz

---

## Politica de Regressao

Se qualquer suite completa falhar:
1. Pausar inclusao de novos testes da onda.
2. Corrigir regressao imediatamente.
3. Reexecutar modulo afetado.
4. Reexecutar suite completa.
5. Somente depois retomar a onda.

---

## Checklist Operacional de Fechamento por Onda

- [ ] Todos os campos alvo da onda foram processados
- [ ] Casos positivo/negativo/fonteira aplicados
- [ ] Matriz atualizada
- [ ] Resumo de onda atualizado
- [ ] Backend tests green
- [ ] Frontend tests green
- [ ] Sem bloqueios abertos sem justificativa

---

## Modelo de Resumo de Onda

Use o seguinte formato ao concluir cada onda:

```
Onda: A|B|C
Data:
Campos alvo:
Campos fechados:
Campos parciais:
Campos nao cobertos:
Falhas encontradas:
Correcoes aplicadas:
Status suites:
Proximo passo:
```

---

## Criterio Final de Aceite do Projeto

A validacao de campos e considerada concluida quando:
1. Todos os campos inventariados estao em `coberto` ou `parcial` com justificativa tecnica aceita.
2. Todos os campos de alto risco possuem cobertura completa.
3. Nao ha falhas nas suites backend e frontend.
4. A matriz final reflete o estado real da cobertura.
