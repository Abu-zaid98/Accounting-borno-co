export const DEFAULT_GLOBAL_CURRENCY = '₪';

export const formatCurrency = (
  value: number,
  currency = DEFAULT_GLOBAL_CURRENCY
): string => {
  const amount = Number.isFinite(value) ? Math.abs(value) : 0;
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatCurrencyPositive = (
  value: number,
  currency = DEFAULT_GLOBAL_CURRENCY
): string => `+${formatCurrency(value, currency)}`;

export const formatCurrencyNegative = (
  value: number,
  currency = DEFAULT_GLOBAL_CURRENCY
): string => `-${formatCurrency(value, currency)}`;

export const CURRENCY_SYMBOL = DEFAULT_GLOBAL_CURRENCY;
