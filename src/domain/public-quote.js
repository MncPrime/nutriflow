export function toPublicQuote(quote) {
  const showPrices = quote.configSnapshot?.show_food_prices ?? false;
  return {
    meals: quote.meals,
    lines: quote.lines.map(line => ({
      name: line.name,
      category: line.category,
      baseUnit: line.baseUnit,
      prescribedAmount: line.prescribedAmount,
      rawAmount: line.rawAmount,
      purchaseAmount: line.purchaseAmount,
      packages: line.packages,
      unitLabel: line.unitLabel,
      pending: line.pending,
      unitMismatch: line.unitMismatch,
      showUnitPrice: showPrices,
      ...(showPrices ? {
        unitPrice: line.unitPrice,
        purchaseCost: line.purchaseCost,
      } : {}),
    })),
    pendingFoods: quote.pendingFoods.map(food => ({
      name: food.name,
      category: food.category,
      baseUnit: food.baseUnit,
      rawAmount: food.rawAmount,
    })),
    marmitaCount: quote.marmitaCount,
    ...(showPrices ? {
      foodCost: quote.foodCost,
      knownFoodCost: quote.knownFoodCost,
      productionCost: quote.productionCost,
      markupAmount: quote.markupAmount,
      appFeeAmount: quote.appFeeAmount,
    } : {}),
    finalPrice: quote.finalPrice,
    unitPrice: quote.unitPrice,
    status: quote.status,
    configError: quote.configError,
    currency: quote.currency,
    syncedAt: quote.syncedAt,
    generatedAt: quote.generatedAt,
    offline: false,
    pricingUnavailable: quote.pricingUnavailable ?? false,
    configSnapshot: {
      currency: quote.currency,
      show_food_prices: showPrices,
    },
  };
}
