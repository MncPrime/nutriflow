# NutriFlow — Pricing Engine v2

## O que mudou

- Preços personalizados são identificados por `foodId|unit`, usando a unidade de preço (kg ou un).
- Conversão de peso cozido para cru usa o fator de cocção do item.
- Embalagem é independente da categoria.
- Custo consumido e desembolso de compra são calculados separadamente.
- A demanda é agregada antes do arredondamento por embalagem.
- O modo “Economizar” compara custo de compra.
- Preços estimados mantêm metadados de origem.
- Preços antigos são migrados quando a correspondência é inequívoca; os demais permanecem disponíveis como fallback.

## Compatibilidade

O motor anterior foi mantido no restante do app. O adaptador do `index.html` converte os itens do plano para o domínio v2. Quantidades em ml não são convertidas em gramas sem uma densidade conhecida.

## Validação

Execute `npm test` e `npm run build`.
