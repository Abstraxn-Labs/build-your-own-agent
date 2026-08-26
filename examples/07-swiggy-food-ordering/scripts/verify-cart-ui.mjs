/**
 * Local verification for Swiggy chat UI parsers / cart normalization.
 * Run: node --experimental-strip-types examples/07-swiggy-food-ordering/scripts/verify-cart-ui.mjs
 * (or plain node after compiling). This file uses duplicated logic so it stays runnable without TSX.
 */
import assert from 'node:assert/strict';

const WIDGET_HINT_RE =
  /A rich UI widget may be shown to the user[\s\S]*?(?:next\.|$)/gi;
const CART_WIDGET_NOISE_RE =
  /Cart widget is displayed[\s\S]*?(?:update_food_cart`?\.?|$)/gi;
const EMPTY_CART_WIDGET_RE = /Cart is empty\.?\s*/gi;

function stripWidgetNoise(text) {
  return text
    .replace(WIDGET_HINT_RE, '')
    .replace(CART_WIDGET_NOISE_RE, '')
    .replace(EMPTY_CART_WIDGET_RE, '')
    .replace(/NOTE:\s*The cart widget[\s\S]*$/gim, '')
    .trim();
}

function isAddonOrVariantNoise(name, line) {
  const hay = `${name} ${line}`.toLowerCase();
  return (
    /^addons?\b/.test(hay) ||
    /^variants?\b/.test(hay) ||
    /\b(group|choice)\s*[:=]/.test(hay) ||
    /\bchoose (your|a)\b/.test(hay)
  );
}

function parseCartFromText(text) {
  const looksEmpty = /cart is empty/i.test(text);
  const cleaned = stripWidgetNoise(text);
  const empty = looksEmpty && !/₹\s*[\d.,]+/.test(cleaned);
  return { empty, cleaned };
}

function normalizeManageCartResult(result, args) {
  const raw = typeof result === 'string' ? result : JSON.stringify(result);
  const action = typeof args.action === 'string' ? args.action : 'view';
  const empty = /cart is empty/i.test(raw);
  const hasPrice = /₹\s*[\d.,]+/.test(raw);
  if (empty && !hasPrice) {
    return {
      empty: true,
      message: action === 'add' || action === 'update' ? 'STILL EMPTY' : 'EMPTY',
    };
  }
  return result;
}

// 1) Widget boilerplate must be stripped
{
  const raw =
    'Cart is empty.\nCart widget is displayed — do not repeat the cart items.\nNOTE: The cart widget has quantity stepper controls via `update_food_cart`.';
  const cleaned = stripWidgetNoise(raw);
  assert.equal(/widget/i.test(cleaned), false, 'widget text should be stripped');
  const parsed = parseCartFromText(raw);
  assert.equal(parsed.empty, true, 'empty cart should be detected before strip');
}

// 2) Real cart text must keep items/total
{
  const raw = '1. Paneer × 1 — ₹345\nTotal ₹408';
  const parsed = parseCartFromText(raw);
  assert.equal(parsed.empty, false);
  assert.match(parsed.cleaned, /Paneer/);
  assert.match(parsed.cleaned, /₹408/);
}

// 3) Addon lines must be noise
{
  assert.equal(
    isAddonOrVariantNoise(
      'Addons (Choose your Biryani)',
      'Addons (Choose your Biryani): [OG (group:1, choice:2)]',
    ),
    true,
  );
  assert.equal(isAddonOrVariantNoise('Hyderabadi Veg Biryani', '₹299'), false);
}

// 4) manage_cart empty after add must not look like success
{
  const out = normalizeManageCartResult(
    'Cart is empty.\nCart widget is displayed — do not repeat.',
    { action: 'add' },
  );
  assert.equal(out.empty, true);
  assert.match(out.message, /STILL EMPTY/);
}

console.log('verify-cart-ui: all checks passed');
