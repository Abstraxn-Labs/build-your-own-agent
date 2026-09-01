export type WarrantDenyReason = {
  code?: string;
  detail?: string;
  layer?: string;
};

export type WarrantDenyPayload = {
  blocked_by?: string;
  verdict?: string;
  reasons?: WarrantDenyReason[];
  checked_amount?: number;
  checked_currency?: string;
  checked_restaurant_id?: string | null;
  hint?: string;
};

function normalizeReasonCodes(reasons: WarrantDenyReason[] | undefined): string[] {
  return (reasons ?? [])
    .map((r) => (typeof r.code === 'string' ? r.code.trim().toUpperCase() : ''))
    .filter(Boolean);
}

/** Plain, product-style copy for policy DENY results (UI + agent). */
export function formatWarrantDenyUserMessage(data: WarrantDenyPayload): {
  title: string;
  summary: string;
  suggestions: string[];
  user_message: string;
} {
  const codes = normalizeReasonCodes(data.reasons);

  const parts: string[] = [];
  const suggestions: string[] = [];

  if (codes.some((c) => c.includes('AMOUNT') && c.includes('MISSING'))) {
    parts.push("We couldn't confirm your order total.");
    suggestions.push('Review your cart and try placing the order again.');
  }

  if (codes.some((c) => c.includes('AMOUNT_MAX'))) {
    parts.push('This order is above your per-order spending limit.');
    suggestions.push('Remove items to lower the total, or update your spending limit.');
  }

  if (codes.some((c) => c.includes('COUNTERPARTY'))) {
    parts.push("This restaurant isn't on your approved list.");
    suggestions.push('Choose a different restaurant, or update your approved restaurants.');
  }

  if (codes.some((c) => c.includes('CATEGORY') || c.includes('DENYLIST'))) {
    parts.push('Some items in your cart are not allowed under your current settings.');
    suggestions.push('Remove those items or pick different options.');
  }

  if (parts.length === 0) {
    parts.push("This order can't be placed with your current spending settings.");
    suggestions.push('Adjust your cart or update your spending settings and try again.');
  }

  const title = "We couldn't place this order";
  const summary = parts.join(' ');
  const user_message = [summary, ...suggestions].join(' ');

  return {
    title,
    summary,
    suggestions,
    user_message,
  };
}

export function warrantDenyPayloadWithUserMessage(
  payload: WarrantDenyPayload,
): WarrantDenyPayload & { user_message: string } {
  const formatted = formatWarrantDenyUserMessage(payload);
  return {
    ...payload,
    user_message: formatted.user_message,
  };
}
