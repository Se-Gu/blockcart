export const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `BCT$ ${value.toFixed(2)}`;
};

export const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};
