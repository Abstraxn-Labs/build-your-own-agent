'use client';

import { useState, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
import {
  formatWarrantDenyUserMessage,
  type WarrantDenyPayload,
} from './warrant-messages';
import { sizeChoicesForItem } from './draft-cart';

type JsonRecord = Record<string, unknown>;

export interface ToolInvocationView {
  id: string;
  toolName: string;
  state: string;
  outputText?: string;
  outputJson?: unknown;
  errorText?: string;
}

const WIDGET_HINT_RE =
  /A rich UI widget may be shown to the user[\s\S]*?(?:next\.|$)/gi;

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function money(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return `₹${value}`;
  if (typeof value === 'string' && value.trim()) {
    return value.startsWith('₹') ? value : `₹${value}`;
  }
  return null;
}

function firstString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

/** Hide backend ids from UI copy; keep them only in pick payloads. */
function stripInternalIds(value: string): string {
  return value
    .replace(/\(ID:\s*[A-Za-z0-9_-]+\)/gi, '')
    .replace(
      /\((?:group|var|variantId|groupId)\s*[:=]\s*[A-Za-z0-9_-]+(?:\s*,\s*(?:group|var|variantId|groupId)\s*[:=]\s*[A-Za-z0-9_-]+)*\)/gi,
      '',
    )
    .replace(
      /\b(?:addressId|restaurantId|restaurantName|menuItemId|menu_item_id|paasId|order[_ ]?id|groupId|variantId|access_token|refresh_token)\s*[:=]\s*['"]?[^,'"}\]\s]+['"]?/gi,
      '',
    )
    .replace(/\bID:\s*[A-Za-z0-9_-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/[\s,·|—\-–]+$/g, '')
    .replace(/^[\s,·|—\-–]+/g, '')
    .trim();
}

/** Turn raw Variants:[500g (group:…, var:…)] into "500g · 1kg". */
function humanizeMenuTags(tags: string): string | undefined {
  let t = tags.trim();
  if (!t) return undefined;

  const variantMatch = t.match(/variants?\s*:\s*\[([^\]]*)\]/i);
  if (variantMatch) {
    const sizes = variantMatch[1]
      .replace(/\([^)]*\)/g, '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !/^\d+$/.test(part));
    t = t.replace(variantMatch[0], sizes.length ? sizes.join(' · ') : '');
  }

  t = stripInternalIds(t)
    .replace(/\bvariants?\s*:\s*/gi, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*[|·]\s*[|·]+/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·,|:-]+|[\s·,|:-]+$/g, '')
    .trim();

  if (!t || /^[+|,·.\-–—]+$/.test(t)) return undefined;
  if (t.length > 64) t = `${t.slice(0, 61)}…`;
  return t;
}

function sizesFromTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(/\s*[·|,]\s*/)
    .map((part) => part.trim())
    .filter((part) => /\d/.test(part) && /(g|kg|ml|l|pc|piece|serve)/i.test(part));
}

function formatVariantSizes(row: JsonRecord): string | null {
  const sizes = extractSizeOptions(row);
  return sizes.length ? sizes.join(' · ') : null;
}

function extractSizeOptions(row: JsonRecord): string[] {
  const names: string[] = [];
  const pushName = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      const cleaned = value.replace(/\(.*?\)/g, '').trim();
      if (!cleaned || names.includes(cleaned)) return;
      // Prefer size-like labels; skip addon/group headers.
      if (isMenuSectionHeader(cleaned)) return;
      if (
        !/\d/.test(cleaned) &&
        !/(piece|pc|serve|small|medium|large|half|full|regular)/i.test(cleaned)
      ) {
        // Still keep short option labels like "Small"
        if (cleaned.length > 24) return;
      }
      names.push(cleaned);
    }
  };

  const walk = (value: unknown, depth = 0) => {
    if (depth > 5 || value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const rec = asRecord(value);
    if (!rec) return;
    pushName(rec.name ?? rec.label ?? rec.variantName ?? rec.size ?? rec.quantity);
    for (const key of [
      'variants',
      'variations',
      'variantsV2',
      'variantGroups',
      'variant_groups',
      'options',
      'choices',
      'items',
      'groups',
    ]) {
      if (key in rec) walk(rec[key], depth + 1);
    }
  };

  walk(row.variants);
  walk(row.variations);
  walk(row.variantsV2);
  walk(row.variantGroups);
  walk(row.variant_groups);

  // Also pull sizes embedded in description / tags text.
  const blob = firstString(row, [
    'tags',
    'description',
    'variantLabel',
    'variantsLabel',
    'variantsText',
  ]);
  for (const part of sizesFromTags(blob)) {
    if (!names.includes(part)) names.push(part);
  }

  return names.slice(0, 8);
}

/** Variant/addon group headers from Swiggy — not real dishes. */
function isMenuSectionHeader(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  return /^(variants?|addons?|add[\s-]?ons?|customis(?:e|ation)s?|options?)\b/i.test(n);
}

type MenuRow = {
  name: string;
  price?: string;
  tags?: string;
  imageUrl?: string;
  restaurant?: string;
  menuItemId?: string;
  restaurantId?: string;
  sizeOptions?: string[];
};

function dedupeMenuRows(rows: MenuRow[]): MenuRow[] {
  const seen = new Set<string>();
  const out: MenuRow[] = [];
  for (const row of rows) {
    if (isMenuSectionHeader(row.name)) continue;
    const key = (row.menuItemId || row.name).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function parseMenuRowsFromData(data: JsonRecord | null, text: string): MenuRow[] {
  let rows: MenuRow[] = [];
  if (data) {
    const list = findArray(data, [
      'items',
      'menuItems',
      'results',
      'dishes',
      'menu',
      'categories',
      'data',
    ]);
    const flattened: JsonRecord[] = [];
    for (const row of list) {
      const nested = asArray(row.items);
      if (nested.length) {
        for (const item of nested) {
          const rec = asRecord(item);
          if (rec) flattened.push(rec);
        }
      } else {
        flattened.push(row);
      }
    }
    rows = flattened.map((row) => {
      const rawTags =
        firstString(row, ['tags', 'description', 'variantLabel', 'variantsLabel']) ||
        [
          row.isVeg === true || row.veg === true ? 'Veg' : null,
          row.isBestseller || row.bestseller ? 'Bestseller' : null,
          formatVariantSizes(row),
        ]
          .filter(Boolean)
          .join(' · ') ||
        undefined;
      return {
        name:
          stripInternalIds(
            firstString(row, ['name', 'itemName', 'menu_item_name', 'title', 'dishName']) ||
              'Item',
          ) || 'Item',
        price: money(row.price) || money(row.finalPrice) || firstString(row, ['price']),
        tags: rawTags ? humanizeMenuTags(rawTags) : undefined,
        imageUrl: resolveImageUrl(
          firstString(row, [
            'image',
            'imageUrl',
            'image_url',
            'cloudinaryImageId',
            'img',
            'thumbnail',
          ]),
        ),
        restaurant: firstString(row, ['restaurantName', 'restaurant_name', 'restaurant']),
        menuItemId: firstString(row, ['menu_item_id', 'menuItemId', 'id', 'itemId']),
        restaurantId: firstString(row, ['restaurantId', 'restaurant_id']),
        sizeOptions: extractSizeOptions(row),
      };
    });
  }
  if (!rows.length) rows = parseMenuItemsFromText(text);
  return dedupeMenuRows(rows);
}

/** Drop JSON / cart-arg dumps the model sometimes pastes into chat text. */
function stripTechnicalPayloads(text: string): string {
  let t = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');

  for (let i = 0; i < 8; i += 1) {
    const next = t.replace(/\{[^{}]*\}/g, (block) =>
      /addressId|restaurantId|menu_item_id|menuItemId|groupId|variantId|access_token|cartItems|"error"|SWIGGY_TOKEN/i.test(
        block,
      )
        ? ''
        : block,
    );
    if (next === t) break;
    t = next;
  }

  for (let i = 0; i < 6; i += 1) {
    const next = t.replace(/\[[^\[\]]*\]/g, (block) =>
      /menu_item_id|groupId|variantId|addressId|cartItems/i.test(block) ? '' : block,
    );
    if (next === t) break;
    t = next;
  }

  t = t
    .replace(
      /(?:we need|cart item|cartItems|payload)\b[\s\S]*?(?=\n\n|$)/gi,
      '',
    )
    .replace(
      /\b(?:addressId|restaurantId|restaurantName|menu_item_id|menuItemId|groupId|variantId|access_token|quantity|action)\b[^\n.]*/gi,
      '',
    );

  return stripInternalIds(
    t
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

/** Turn Swiggy cloudinary ids / relative paths into usable image URLs. */
function resolveImageUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.includes('/') || /^[a-z0-9_-]+$/i.test(trimmed)) {
    return `https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_280,h_280,c_fill/${trimmed.replace(/^\/+/, '')}`;
  }
  return undefined;
}

function splitRestaurantMeta(meta: string): {
  cuisines?: string;
  rating?: string;
  eta?: string;
  cost?: string;
} {
  const rating = meta.match(/([\d.]+)\s*★/)?.[1];
  const eta = meta.match(/(\d+)\s*min/i)?.[0];
  const cost = meta.match(/₹\s*[\d.,]+\s*(?:for two)?/i)?.[0]?.replace(/\s+/g, ' ');
  let cuisines = meta
    .replace(/([\d.]+)\s*★/g, '')
    .replace(/\d+\s*min/gi, '')
    .replace(/₹\s*[\d.,]+\s*(?:for two)?/gi, '')
    .replace(/(?:restaurant(?:Id|_id)?|ID)[:\s]+[A-Za-z0-9_-]+/gi, '')
    .replace(/\(ID:\s*[A-Za-z0-9_-]+\)/gi, '')
    .replace(/\s*[·|•]\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·,|]+|[\s·,|]+$/g, '')
    .trim();
  if (cuisines.length > 72) cuisines = `${cuisines.slice(0, 69)}…`;
  return { cuisines: cuisines || undefined, rating, eta, cost };
}

function findArray(root: JsonRecord, keys: string[]): JsonRecord[] {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value.map(asRecord).filter((r): r is JsonRecord => !!r);
    }
  }
  for (const wrap of ['data', 'result', 'payload', 'response']) {
    const nested = asRecord(root[wrap]);
    if (!nested) continue;
    for (const key of keys) {
      const value = nested[key];
      if (Array.isArray(value)) {
        return value.map(asRecord).filter((r): r is JsonRecord => !!r);
      }
    }
  }
  return [];
}

function extractImageFromText(line: string): string | undefined {
  const patterns = [
    /\[image:\s*(https?:\/\/[^\]\s]+)\]/i,
    /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i,
    /\((https?:\/\/(?:media-assets\.swiggy\.com|res\.cloudinary\.com)[^)\s]*)\)/i,
    /(https?:\/\/(?:media-assets\.swiggy\.com|res\.cloudinary\.com)[^\s\]"'<>]+)/i,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m?.[1]) return resolveImageUrl(m[1]);
  }
  return undefined;
}

function parseToolPayload(raw: unknown): { json: unknown; text: string } {
  const textFromRecord = (record: JsonRecord): string | null => {
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.replace(WIDGET_HINT_RE, '').trim();
    }
    if (Array.isArray(record.content)) {
      const text = record.content
        .map((c) => {
          const row = asRecord(c);
          return row && typeof row.text === 'string' ? row.text : '';
        })
        .filter(Boolean)
        .join('\n')
        .replace(WIDGET_HINT_RE, '')
        .trim();
      return text || null;
    }
    if (typeof record.text === 'string' && record.text.trim()) {
      return record.text.replace(WIDGET_HINT_RE, '').trim();
    }
    return null;
  };

  if (typeof raw !== 'string') {
    const record = asRecord(raw);
    if (record) {
      const text = textFromRecord(record);
      if (text) return { json: raw, text };
    }
    return {
      json: raw,
      text: raw == null ? '' : JSON.stringify(raw, null, 2),
    };
  }

  const cleaned = raw.replace(WIDGET_HINT_RE, '').trim();
  const asJson = tryParseJson(cleaned);
  const record = asRecord(asJson);
  if (record) {
    const text = textFromRecord(record);
    if (text) return { json: asJson, text };
  }
  if (asJson !== cleaned && typeof asJson === 'object') {
    return { json: asJson, text: cleaned };
  }
  return { json: asJson, text: cleaned };
}

export function toolInvocations(message: UIMessage): ToolInvocationView[] {
  const views: ToolInvocationView[] = [];
  for (const part of message.parts) {
    const isTool =
      part.type === 'dynamic-tool' ||
      (typeof part.type === 'string' && part.type.startsWith('tool-'));
    if (!isTool) continue;

    const toolName =
      'toolName' in part && typeof part.toolName === 'string'
        ? part.toolName
        : part.type === 'dynamic-tool'
          ? 'tool'
          : part.type.replace(/^tool-/, '');
    const state = 'state' in part && typeof part.state === 'string' ? part.state : 'unknown';
    const id =
      'toolCallId' in part && typeof part.toolCallId === 'string'
        ? part.toolCallId
        : `${message.id}-${toolName}-${views.length}`;

    if (state === 'output-error' && 'errorText' in part) {
      const errorText = String(part.errorText ?? 'Tool error');
      // Some MCP failures still carry useful list text — keep it for rich feeds.
      const { json, text } = parseToolPayload(errorText);
      views.push({
        id,
        toolName,
        state,
        errorText,
        outputText: text,
        outputJson: typeof json === 'object' ? json : undefined,
      });
      continue;
    }

    if (state === 'output-available' && 'output' in part) {
      const { json, text } = parseToolPayload(part.output);
      views.push({
        id,
        toolName,
        state,
        outputText: text,
        outputJson: json,
      });
      continue;
    }

    views.push({ id, toolName, state });
  }
  return views;
}

function extractPaymentFields(root: JsonRecord): {
  paymentUrl?: string;
  paymentQrImage?: string;
  paymentQrPayload?: string;
  paasId?: string;
  orderId?: string;
  status?: string;
  pendingPayment: boolean;
  placed: boolean;
} {
  const found: {
    paymentUrl?: string;
    paymentQrImage?: string;
    paymentQrPayload?: string;
    paasId?: string;
    orderId?: string;
    status?: string;
  } = {};

  const visit = (value: unknown, depth: number) => {
    if (depth > 6 || value == null) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (!found.paymentQrImage && /^data:image\//i.test(trimmed)) {
        found.paymentQrImage = trimmed;
      } else if (
        !found.paymentUrl &&
        (/^upi:/i.test(trimmed) || /^https?:\/\//i.test(trimmed) || /^intent:/i.test(trimmed))
      ) {
        found.paymentUrl = trimmed;
        if (/^upi:/i.test(trimmed) && !found.paymentQrPayload) {
          found.paymentQrPayload = trimmed;
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;
    const obj = value as JsonRecord;
    for (const [key, child] of Object.entries(obj)) {
      if (!found.paasId && (key === 'paasId' || key === 'paas_id') && typeof child === 'string') {
        found.paasId = child.trim();
      }
      if (
        !found.orderId &&
        (key === 'order_id' || key === 'orderId') &&
        typeof child === 'string'
      ) {
        found.orderId = child.trim();
      }
      if (!found.status && (key === 'status' || key === 'paymentStatus') && typeof child === 'string') {
        found.status = child.trim();
      }
      if (
        !found.paymentUrl &&
        ['paymentUrl', 'payment_url', 'paymentLink', 'upiLink', 'deepLink', 'intentUrl'].includes(
          key,
        ) &&
        typeof child === 'string'
      ) {
        found.paymentUrl = child.trim();
      }
      if (
        !found.paymentQrImage &&
        ['paymentQrImage', 'qrImage', 'qr_image', 'qrCodeImage'].includes(key) &&
        typeof child === 'string'
      ) {
        found.paymentQrImage = child.trim();
      }
      if (
        !found.paymentQrPayload &&
        ['paymentQrPayload', 'qrData', 'qr_data', 'qrCode', 'upiString'].includes(key) &&
        typeof child === 'string' &&
        !/^https?:\/\//i.test(child) &&
        !/^data:image\//i.test(child)
      ) {
        found.paymentQrPayload = child.trim();
      }
      visit(child, depth + 1);
    }
  };

  visit(root, 0);
  if (!found.paymentQrPayload && found.paymentUrl && /^upi:/i.test(found.paymentUrl)) {
    found.paymentQrPayload = found.paymentUrl;
  }

  const pendingPayment =
    root.pendingPayment === true ||
    (typeof found.status === 'string' && found.status.toUpperCase() === 'PENDING_PAYMENT') ||
    (typeof root.paymentStatus === 'string' &&
      root.paymentStatus.toUpperCase() === 'PENDING_PAYMENT') ||
    (typeof root.status === 'string' && root.status.toUpperCase() === 'PENDING_PAYMENT');

  return { ...found, pendingPayment, placed: root.placed === true };
}

function qrImageSrc(payload: {
  paymentQrImage?: string;
  paymentQrPayload?: string;
  paymentUrl?: string;
}): string | null {
  if (payload.paymentQrImage) {
    if (
      payload.paymentQrImage.startsWith('data:image/') ||
      /^https?:\/\//i.test(payload.paymentQrImage)
    ) {
      return payload.paymentQrImage;
    }
    if (/^[A-Za-z0-9+/=]+$/.test(payload.paymentQrImage) && payload.paymentQrImage.length > 64) {
      return `data:image/png;base64,${payload.paymentQrImage}`;
    }
  }
  const data = payload.paymentQrPayload || payload.paymentUrl;
  if (!data) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(data)}`;
}

export interface WidgetActions {
  onPick?: (text: string) => void;
  onAddToDraft?: (item: {
    menuItemId?: string;
    name: string;
    size?: string;
    sizeOptions?: string[];
    quantity?: number;
    unitPrice?: number;
    restaurantId?: string;
    restaurantName?: string;
    imageUrl?: string;
  }) => void;
  onSelectAddress?: (id: string, label: string) => void;
  onSelectRestaurant?: (id: string, name: string) => void;
  disabled?: boolean;
  /** When true, address cards are from an older get_addresses turn — not clickable. */
  addressesStale?: boolean;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="chat-section-label">{children}</div>;
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={primary ? 'chat-btn chat-btn-primary' : 'chat-btn'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ---------------- parsers ---------------- */

function parseAddressesFromText(text: string) {
  const items: Array<{ id?: string; label: string; detail: string }> = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const m =
      trimmed.match(
        /^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[—(]\s*['"`]?([A-Za-z0-9_-]{6,})['"`]?\s*[)—]?\s*(.*)$/,
      ) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (!m) continue;
    if (m[2] && /^[A-Za-z0-9_-]{6,}$/.test(m[2])) {
      items.push({
        label: m[1].replace(/\*\*/g, '').trim(),
        id: m[2],
        detail: (m[3] || '').trim(),
      });
    } else {
      items.push({ label: (m[1] || trimmed).replace(/\*\*/g, '').trim(), detail: '' });
    }
  }
  return items;
}

function parseRestaurantsFromText(text: string) {
  const items: Array<{
    name: string;
    meta: string;
    id?: string;
    imageUrl?: string;
    rating?: string;
    eta?: string;
    cost?: string;
    cuisines?: string;
    status?: string;
  }> = [];
  for (const line of text.split('\n')) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    const imageMatch = trimmed.match(/\[image:\s*(https?:\/\/[^\]\s]+)\]/i);
    const imageUrl = extractImageFromText(trimmed) || resolveImageUrl(imageMatch?.[1]);
    trimmed = trimmed
      .replace(/\s*\[image:\s*https?:\/\/[^\]\s]+\]/gi, '')
      .replace(/\s*!\[[^\]]*]\(https?:\/\/[^)]+\)/gi, '')
      .trim();
    const m = trimmed.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[—\-–]\s*(.+)$/);
    if (!m) continue;
    const idMatch = trimmed.match(/(?:restaurant(?:Id|_id)?|ID)[:\s]+([A-Za-z0-9_-]+)/i);
    const bits = splitRestaurantMeta(m[2]);
    items.push({
      name: m[1].replace(/\*\*/g, '').trim(),
      meta: m[2].replace(/\(ID:\s*[A-Za-z0-9_-]+\)/gi, '').trim(),
      id: idMatch?.[1],
      imageUrl,
      rating: bits.rating,
      eta: bits.eta,
      cost: bits.cost,
      cuisines: bits.cuisines,
    });
  }
  return items;
}

function parseMenuItemsFromText(text: string) {
  const restaurantHeader = text.match(/Menu for\s+(.+?)\s*\(ID:\s*([A-Za-z0-9_-]+)\)/i);
  const restaurantName = restaurantHeader?.[1]?.trim();
  const restaurantId = restaurantHeader?.[2];
  const rows: Array<{
    name: string;
    price?: string;
    tags?: string;
    imageUrl?: string;
    menuItemId?: string;
    restaurantId?: string;
    restaurant?: string;
  }> = [];

  for (const rawLine of text.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^menu for\s+/i.test(line)) continue;
    if (/^#+\s*/.test(line) && !/₹/.test(line)) continue;
    if (/rich UI widget/i.test(line)) continue;
    line = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');

    const imageUrl = extractImageFromText(line);
    const withoutImage = line
      .replace(/\s*\[image:\s*https?:\/\/[^\]\s]+\]/gi, '')
      .replace(/\s*!\[[^\]]*]\(https?:\/\/[^)]+\)/gi, '')
      .replace(
        /\s*https?:\/\/(?:media-assets\.swiggy\.com|res\.cloudinary\.com)[^\s\]"'<>]+/gi,
        '',
      )
      .trim();
    const idMatch =
      withoutImage.match(/\(ID:\s*([A-Za-z0-9_-]+)\)/i) ||
      withoutImage.match(/\bID:\s*([A-Za-z0-9_-]+)\b/i);
    const menuItemId = idMatch?.[1];
    const withoutId = withoutImage
      .replace(/\(ID:\s*[A-Za-z0-9_-]+\)/gi, '')
      .replace(/\bID:\s*[A-Za-z0-9_-]+\b/gi, '')
      .trim();
    const priceMatch = withoutId.match(/₹\s*[\d.,]+/);
    if (!priceMatch && !menuItemId) continue;
    const parts = withoutId
      .split(/\s*[—–\-]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    let name = (parts[0] || withoutId).replace(/\s*₹\s*[\d.,]+.*$/, '').trim();
    if (!name || name.length < 2) continue;
    const tags = humanizeMenuTags(
      parts
        .slice(1)
        .join(' · ')
        .replace(/₹\s*[\d.,]+/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s·,|]+|[\s·,|]+$/g, '')
        .trim(),
    );
    rows.push({
      name: stripInternalIds(name) || name,
      price: priceMatch?.[0]?.replace(/\s+/g, ''),
      tags,
      imageUrl,
      menuItemId,
      restaurantId,
      restaurant: restaurantName,
    });
  }
  return rows;
}

/* ---------------- chat-native widgets ---------------- */

function MetaChips({
  rating,
  eta,
  cost,
}: {
  rating?: string;
  eta?: string;
  cost?: string;
}) {
  if (!rating && !eta && !cost) return null;
  return (
    <div className="chat-meta-chips">
      {rating ? <span className="chat-chip chat-chip-rating">★ {rating}</span> : null}
      {eta ? <span className="chat-chip">{eta}</span> : null}
      {cost ? <span className="chat-chip">{cost}</span> : null}
    </div>
  );
}

function AddressesFeed({
  data,
  text,
  actions,
}: {
  data: JsonRecord | null;
  text: string;
  actions?: WidgetActions;
}) {
  let rows: Array<{ id?: string; label: string; detail: string }> = [];
  if (data) {
    const list = findArray(data, ['addresses', 'addressList', 'savedAddresses', 'items', 'data']);
    rows = list.map((row, index) => {
      const id = firstString(row, ['addressId', 'address_id', 'id']);
      const rawLabel =
        firstString(row, ['name', 'label', 'addressName', 'tag', 'nickname']) ||
        `Address ${index + 1}`;
      const rawDetail =
        firstString(row, [
          'formattedAddress',
          'fullAddress',
          'address',
          'displayAddress',
        ]) ||
        [row.address_line_1, row.addressLine1, row.area, row.city, row.pincode]
          .filter((v) => typeof v === 'string' && v.trim())
          .join(', ');
      return {
        id,
        label: stripInternalIds(rawLabel) || `Address ${index + 1}`,
        detail: stripInternalIds(rawDetail),
      };
    });
  }
  if (!rows.length) {
    rows = parseAddressesFromText(text).map((row) => ({
      ...row,
      label: stripInternalIds(row.label) || row.label,
      detail: stripInternalIds(row.detail),
    }));
  }
  if (!rows.length) return null;

  const stale = Boolean(actions?.addressesStale);
  const pickDisabled =
    stale || actions?.disabled || !(actions?.onPick || actions?.onSelectAddress);

  return (
    <div className="chat-feed-block">
      <SectionLabel>{stale ? 'Earlier addresses (outdated)' : 'Deliver to'}</SectionLabel>
      {stale ? (
        <p className="chat-row-sub" style={{ margin: '0 0 8px' }}>
          Tap a card from the latest address list only — or ask to refresh addresses.
        </p>
      ) : null}
      <div className="chat-stack chat-stack-scroll">
        {rows.map((row, index) => {
          const label = stripInternalIds(row.label) || row.label;
          const detail = stripInternalIds(row.detail);
          return (
            <button
              key={`${row.id || label}-${index}`}
              type="button"
              className="chat-choice-card"
              disabled={pickDisabled}
              onClick={() => {
                if (stale) return;
                if (row.id) actions?.onSelectAddress?.(row.id, label);
                actions?.onPick?.(
                  row.id
                    ? `Use address ${index + 1}: ${label} (addressId ${row.id})`
                    : `Use address ${index + 1}: ${label}`,
                );
              }}
            >
              <div className="chat-row-title">{label}</div>
              {detail ? <div className="chat-row-sub">{detail}</div> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RestaurantsFeed({
  data,
  text,
  actions,
}: {
  data: JsonRecord | null;
  text: string;
  actions?: WidgetActions;
}) {
  let rows: Array<{
    name: string;
    meta: string;
    id?: string;
    imageUrl?: string;
    rating?: string;
    eta?: string;
    cost?: string;
    cuisines?: string;
    status?: string;
  }> = [];

  if (data) {
    const list = findArray(data, ['restaurants', 'results', 'items', 'restaurantList', 'data']);
    rows = list.map((row) => {
      const id = firstString(row, ['restaurantId', 'restaurant_id', 'id']);
      const name =
        firstString(row, ['name', 'restaurantName', 'restaurant_name', 'title']) || 'Restaurant';
      const cuisines = Array.isArray(row.cuisines)
        ? row.cuisines.filter((c) => typeof c === 'string').slice(0, 3).join(', ')
        : firstString(row, ['cuisine', 'cuisines', 'category']);
      const rating = firstString(row, ['rating', 'avgRating', 'avg_rating']);
      const sla =
        firstString(row, ['sla', 'deliveryTime', 'delivery_time', 'slaString']) ||
        (typeof row.sla === 'object' && row.sla
          ? firstString(row.sla as JsonRecord, ['deliveryTime', 'slaString'])
          : undefined);
      const cost =
        money(row.costForTwo) ||
        money(row.cost_for_two) ||
        (firstString(row, ['costForTwo'])
          ? `${firstString(row, ['costForTwo'])} for two`
          : undefined);
      const status = firstString(row, ['availabilityStatus', 'status']);
      const imageUrl = resolveImageUrl(
        firstString(row, [
          'image',
          'imageUrl',
          'image_url',
          'cloudinaryImageId',
          'logo',
          'thumbnail',
        ]),
      );
      const meta = [cuisines, rating ? `★ ${rating}` : null, sla, cost].filter(Boolean).join(' · ');
      return {
        name,
        meta,
        id,
        imageUrl,
        rating: rating || undefined,
        eta: sla || undefined,
        cost: cost || undefined,
        cuisines: cuisines || undefined,
        status,
      };
    });
  }
  if (!rows.length) rows = parseRestaurantsFromText(text);
  if (!rows.length) return null;

  return (
    <div className="chat-feed-block">
      <SectionLabel>Nearby restaurants</SectionLabel>
      <div className="chat-stack chat-stack-scroll">
        {rows.slice(0, 20).map((row, index) => (
          <button
            key={`${row.id || row.name}-${index}`}
            type="button"
            className="chat-media-card chat-media-card-btn"
            disabled={actions?.disabled || !(actions?.onPick || actions?.onSelectRestaurant)}
            onClick={() => {
              if (row.id) actions?.onSelectRestaurant?.(row.id, row.name);
              actions?.onPick?.(
                row.id
                  ? `Select restaurant ${row.name} (restaurantId ${row.id})`
                  : `Select restaurant ${index + 1}: ${row.name}`,
              );
            }}
          >
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" className="chat-thumb" />
            ) : (
              <div className="chat-thumb chat-thumb-fallback" aria-hidden>
                <span>{row.name.slice(0, 1).toUpperCase()}</span>
              </div>
            )}
            <div className="chat-media-body">
              <div className="chat-row-title-row">
                <div className="chat-row-title">{row.name}</div>
                {row.status && /open|closed/i.test(row.status) ? (
                  <span
                    className={
                      /open/i.test(row.status) ? 'chat-pill ok' : 'chat-pill danger'
                    }
                  >
                    {row.status}
                  </span>
                ) : null}
              </div>
              {row.cuisines ? <div className="chat-row-sub">{row.cuisines}</div> : null}
              <MetaChips rating={row.rating} eta={row.eta} cost={row.cost} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuFeed({
  data,
  text,
  rows: rowsProp,
  actions,
}: {
  data?: JsonRecord | null;
  text?: string;
  rows?: MenuRow[];
  actions?: WidgetActions;
}) {
  const [sizePrompt, setSizePrompt] = useState<{
    name: string;
    menuItemId?: string;
    restaurantId?: string;
    restaurantName?: string;
    imageUrl?: string;
    unitPrice?: number;
    sizes: string[];
  } | null>(null);

  const rows = rowsProp ?? parseMenuRowsFromData(data ?? null, text || '');
  if (!rows.length) return null;

  const pushDraft = (payload: {
    name: string;
    menuItemId?: string;
    restaurantId?: string;
    restaurantName?: string;
    imageUrl?: string;
    unitPrice?: number;
    size?: string;
    sizeOptions?: string[];
  }) => {
    if (actions?.onAddToDraft) {
      actions.onAddToDraft({
        ...payload,
        quantity: 1,
      });
      return;
    }
    const sizeBit = payload.size ? ` size ${payload.size}` : '';
    actions?.onPick?.(
      payload.menuItemId
        ? `Add ${payload.name}${sizeBit} to cart (menu_item_id ${payload.menuItemId}${
            payload.restaurantId ? `, restaurantId ${payload.restaurantId}` : ''
          }) quantity 1`
        : `Order ${payload.name}${sizeBit}`,
    );
  };

  return (
    <div className="chat-feed-block">
      <SectionLabel>Menu picks</SectionLabel>
      <div className="chat-carousel">
        {rows.slice(0, 36).map((row, index) => {
          const sizes = sizeChoicesForItem({
            name: row.name,
            sizeOptions: row.sizeOptions?.length
              ? row.sizeOptions
              : sizesFromTags(row.tags),
            tags: row.tags,
          });
          const unitPrice = (() => {
            if (!row.price) return undefined;
            const m = row.price.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
            return m ? Number(m[1]) : undefined;
          })();
          return (
            <article key={`${row.menuItemId || row.name}-${index}`} className="chat-dish-card">
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.imageUrl} alt={row.name} className="chat-dish-img" />
              ) : (
                <div className="chat-dish-img chat-thumb-fallback" aria-hidden />
              )}
              <div className="chat-dish-body">
                <div className="chat-row-title">{row.name}</div>
                {row.tags ? <div className="chat-row-sub">{row.tags}</div> : null}
                {sizes.length > 0 ? (
                  <div className="chat-size-chips" role="group" aria-label={`Sizes for ${row.name}`}>
                    {sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className="chat-size-chip"
                        disabled={actions?.disabled}
                        onClick={() => {
                          pushDraft({
                            name: row.name,
                            menuItemId: row.menuItemId,
                            restaurantId: row.restaurantId,
                            restaurantName: row.restaurant,
                            imageUrl: row.imageUrl,
                            unitPrice,
                            size,
                            sizeOptions: sizes,
                          });
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="chat-dish-footer">
                  {row.price ? <div className="chat-price">{row.price}</div> : <span />}
                  {actions?.onAddToDraft || actions?.onPick ? (
                    <ActionBtn
                      primary
                      disabled={actions.disabled}
                      onClick={() => {
                        if (sizes.length > 1) {
                          setSizePrompt({
                            name: row.name,
                            menuItemId: row.menuItemId,
                            restaurantId: row.restaurantId,
                            restaurantName: row.restaurant,
                            imageUrl: row.imageUrl,
                            unitPrice,
                            sizes,
                          });
                          return;
                        }
                        pushDraft({
                          name: row.name,
                          menuItemId: row.menuItemId,
                          restaurantId: row.restaurantId,
                          restaurantName: row.restaurant,
                          imageUrl: row.imageUrl,
                          unitPrice,
                          size: sizes[0],
                          sizeOptions: sizes.length ? sizes : undefined,
                        });
                      }}
                    >
                      {sizes.length > 1 ? 'Pick size' : 'Add'}
                    </ActionBtn>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {sizePrompt ? (
        <div className="size-picker" role="dialog" aria-label="Choose size">
          <div className="size-picker-card">
            <div className="size-picker-title">Choose size for {sizePrompt.name}</div>
            <div className="size-picker-options">
              {sizePrompt.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="chat-btn chat-btn-primary"
                  disabled={actions?.disabled}
                  onClick={() => {
                    pushDraft({
                      ...sizePrompt,
                      size,
                      sizeOptions: sizePrompt.sizes,
                    });
                    setSizePrompt(null);
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="chat-btn"
              onClick={() => setSizePrompt(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaymentOptionsFeed({ data, actions }: { data: JsonRecord; actions?: WidgetActions }) {
  const methods: JsonRecord[] = [];
  const pushMethods = (value: unknown) => {
    for (const row of asArray(value)) {
      const rec = asRecord(row);
      if (rec) methods.push(rec);
    }
  };
  pushMethods(data.allMethods);
  pushMethods(data.methods);
  const platforms = asRecord(data.platforms);
  if (platforms) {
    pushMethods(asRecord(platforms.mobile)?.methods);
    pushMethods(asRecord(platforms.desktop)?.methods);
  }
  const nested = asRecord(data.data);
  if (nested && !methods.length) {
    pushMethods(nested.allMethods);
    const nestedPlatforms = asRecord(nested.platforms);
    if (nestedPlatforms) {
      pushMethods(asRecord(nestedPlatforms.mobile)?.methods);
      pushMethods(asRecord(nestedPlatforms.desktop)?.methods);
    }
  }

  const seen = new Set<string>();
  const unique = methods.filter((m) => {
    const key = firstString(m, ['id', 'displayName', 'name']) || JSON.stringify(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) return null;

  return (
    <div className="chat-feed-block">
      <SectionLabel>Pay with</SectionLabel>
      <div className="chat-stack">
        {unique.map((method, index) => {
          const name =
            firstString(method, ['displayName', 'name', 'title', 'id']) || `Method ${index + 1}`;
          const id = firstString(method, ['id', 'methodId']);
          const icon = resolveImageUrl(
            firstString(method, ['iconUrl', 'icon', 'imageUrl', 'logo']),
          );
          const isUpi = /upi|gpay|google|phonepe|paytm|bhim|cred|qr/i.test(`${name} ${id || ''}`);
          return (
            <button
              key={`${id || name}-${index}`}
              type="button"
              className="chat-choice-card chat-choice-row"
              disabled={actions?.disabled || !actions?.onPick}
              onClick={() =>
                actions?.onPick?.(
                  isUpi
                    ? `Pay with UPI (show QR). I choose ${name}.`
                    : `Use payment method ${name}`,
                )
              }
            >
              {icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="chat-icon" />
              ) : (
                <div className="chat-icon chat-icon-fallback" />
              )}
              <div className="chat-row-body">
                <div className="chat-row-title">{name}</div>
                {isUpi ? <div className="chat-row-sub">Scan QR in chat</div> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ParsedCartLine = { name: string; price?: string; qty: number };
type ParsedCartFee = { label: string; amount: string; discount?: boolean };

function parseCartSummaryFromText(text: string): {
  empty: boolean;
  addFailed: boolean;
  summary: string;
  total?: string;
  restaurant?: string;
  lines: ParsedCartLine[];
  fees: ParsedCartFee[];
} {
  const raw = text.trim();
  if (!raw) {
    return { empty: false, addFailed: false, summary: '', lines: [], fees: [] };
  }

  const addFailed = /still empty|item was NOT added|was not added/i.test(raw);
  const looksEmpty =
    addFailed ||
    /cart is(?:\s+still)?\s+empty/i.test(raw) ||
    /empty after add/i.test(raw);

  const cleaned = raw
    .replace(WIDGET_HINT_RE, '')
    .replace(/Cart widget is displayed[\s\S]*?(?:update_food_cart`?\.?|$)/gi, '')
    .replace(/Cart is(?:\s+STILL)?\s+EMPTY[\s\S]*?(?:none\.|$)/gi, '')
    .replace(/Cart is empty\.?\s*/gi, '')
    .replace(/Call swiggy_manage_cart[\s\S]*$/gim, '')
    .replace(/Likely missing[\s\S]*$/gim, '')
    .replace(/Retry with the correct[\s\S]*$/gim, '')
    .replace(/Never mention a cart widget[\s\S]*$/gim, '')
    .replace(/NOTE:\s*The cart widget[\s\S]*$/gim, '')
    .replace(/[⚠️⚠]/g, '')
    .trim();

  const restaurant =
    cleaned.match(/Restaurant\s*:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ||
    cleaned.match(/Restaurant\s*:\s*(.+?)(?:\s+Items\b)/i)?.[1]?.trim();

  const lines: ParsedCartLine[] = [];
  const itemChunk =
    cleaned.match(/Items?\s*\(\d+\)\s*:?\s*([\s\S]*?)(?=(?:Delivery|Taxes|Coupon|TO PAY|Total)\b)/i)?.[1] ||
    cleaned.match(/Items?\s*:?\s*([\s\S]*?)(?=(?:Delivery|Taxes|Coupon|TO PAY|Total)\b)/i)?.[1] ||
    '';

  const itemMatches = [
    ...itemChunk.matchAll(
      /[-•]\s*([^—\n]+?)\s*[—–-]\s*(₹\s*[\d.,]+)/gi,
    ),
  ];
  for (const m of itemMatches) {
    const name = stripInternalIds(m[1].replace(/\s+/g, ' ').trim());
    if (!name || /item total/i.test(name)) continue;
    lines.push({ name, price: m[2].replace(/\s+/g, ''), qty: 1 });
  }

  if (!lines.length) {
    for (const line of cleaned.split('\n')) {
      const m = line.trim().match(/^[-•*]?\s*(.+?)\s*[—–x×]\s*(\d+)?\s*(₹\s*[\d.,]+)?$/i);
      if (!m) continue;
      const name = stripInternalIds(m[1]);
      if (!name || /^(restaurant|items?|delivery|taxes|coupon|to pay|total|item total)/i.test(name)) {
        continue;
      }
      lines.push({
        name,
        qty: m[2] ? Number(m[2]) : 1,
        price: m[3]?.replace(/\s+/g, ''),
      });
    }
  }

  const fees: ParsedCartFee[] = [];
  const feePatterns: Array<[RegExp, boolean?]> = [
    [/Delivery\s*:\s*(₹\s*[\d.,]+)/i, false],
    [/Taxes?(?:\s*&\s*charges)?\s*:\s*(₹\s*[\d.,]+)/i, false],
    [/Coupon\s*(?:\(([^)]+)\))?\s*:\s*(-?\s*₹\s*[\d.,]+)/i, true],
    [/Item total\s*:\s*(₹\s*[\d.,]+)/i, false],
  ];
  for (const [re, discount] of feePatterns) {
    const m = cleaned.match(re);
    if (!m) continue;
    const label =
      re.source.startsWith('Delivery')
        ? 'Delivery'
        : re.source.startsWith('Taxes')
          ? 'Taxes & charges'
          : re.source.startsWith('Coupon')
            ? `Coupon${m[1] ? ` (${m[1]})` : ''}`
            : 'Item total';
    const amount = (m[2] || m[1] || '').replace(/\s+/g, '');
    if (!amount) continue;
    fees.push({ label, amount, discount });
  }

  const totalMatch =
    cleaned.match(/TO PAY\s*:\s*(₹\s*[\d.,]+)/i) ||
    cleaned.match(/Total\s*(₹\s*[\d.,]+)/i);
  const total = totalMatch?.[1]?.replace(/\s+/g, '');

  const userSummary = stripTechnicalPayloads(cleaned)
    .replace(/swiggy_[a-z_]+/gi, '')
    .replace(/variants?V2/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const isAgentNoise =
    looksEmpty ||
    (!userSummary && !lines.length && !total) ||
    (/menu_item_id|restaurantId|addressId|variantsV2|cart widget/i.test(cleaned) &&
      !lines.length &&
      !total);

  const empty = (looksEmpty || isAgentNoise) && !total && !lines.length;

  return {
    empty,
    addFailed,
    summary: empty ? '' : userSummary,
    total: total || undefined,
    restaurant: restaurant ? stripInternalIds(restaurant) : undefined,
    lines,
    fees,
  };
}

function CartFeed({
  data,
  text = '',
}: {
  data: JsonRecord | null;
  text?: string;
}) {
  const root = data ?? {};
  const cart = (data ? asRecord(data.cart) : null) ?? root;
  const rawItems = Array.isArray(cart.items)
    ? cart.items
    : Array.isArray(cart.cartItems)
      ? cart.cartItems
      : [];
  const totalFromData =
    money(cart.total) ||
    money(cart.grandTotal) ||
    money(cart.orderTotal) ||
    money(cart.billTotal) ||
    money(cart.toPay);
  const restaurantFromData =
    firstString(cart, ['restaurantName', 'restaurant_name', 'restaurant']) ||
    firstString(root, ['restaurantName', 'restaurant_name']);
  const fromText = parseCartSummaryFromText(text);

  const structuredLines: ParsedCartLine[] = rawItems.length
    ? rawItems.slice(0, 12).map((item, index) => {
        const row = asRecord(item) ?? {};
        const name =
          firstString(row, ['name', 'item_name', 'menu_item_name']) || `Item ${index + 1}`;
        const qty = typeof row.quantity === 'number' ? row.quantity : 1;
        const price = money(row.price) || money(row.finalPrice) || money(row.total);
        return { name: stripInternalIds(name), qty, price: price || undefined };
      })
    : fromText.lines;

  const restaurant = restaurantFromData || fromText.restaurant;
  const total = totalFromData || fromText.total;
  const hasItems = structuredLines.length > 0;

  if (!hasItems && (fromText.empty || fromText.addFailed)) {
    return (
      <div className="chat-feed-block">
        <div className="synced-cart-card synced-cart-card-empty">
          <div className="synced-cart-head">
            <div className="synced-cart-title">Your cart</div>
          </div>
          <div className="synced-cart-empty-body">
            <div className="chat-row-title">
              {fromText.addFailed ? "We couldn't update your order" : 'Your order is empty'}
            </div>
            <div className="chat-row-sub">
              {fromText.addFailed
                ? 'Some items still need a size or add-on. Tell the agent which options you want, then try again.'
                : 'Pick a dish from the menu to get started.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasItems && !total && !fromText.summary && !restaurant && !data) {
    return null;
  }

  const delivery = money(cart.deliveryFee) || money(cart.delivery);
  const taxes = money(cart.taxes) || money(cart.tax);
  const fees: ParsedCartFee[] = [...fromText.fees];
  if (delivery && !fees.some((f) => /delivery/i.test(f.label))) {
    fees.push({ label: 'Delivery', amount: delivery });
  }
  if (taxes && !fees.some((f) => /tax/i.test(f.label))) {
    fees.push({ label: 'Taxes & charges', amount: taxes });
  }

  return (
    <div className="chat-feed-block">
      <div className="synced-cart-card">
        <div className="synced-cart-head">
          <div>
            <div className="synced-cart-title">Your cart</div>
            {restaurant ? <div className="synced-cart-sub">{restaurant}</div> : null}
          </div>
          {hasItems ? (
            <div className="synced-cart-badge">
              {structuredLines.reduce((n, row) => n + row.qty, 0)} items
            </div>
          ) : null}
        </div>

        {hasItems ? (
          <ul className="synced-cart-list">
            {structuredLines.map((row, index) => (
              <li key={`${row.name}-${index}`} className="synced-cart-row">
                <div className="synced-cart-row-main">
                  <div className="synced-cart-row-title">
                    {row.name}
                    {row.qty > 1 ? <span> × {row.qty}</span> : null}
                  </div>
                  {row.price ? <div className="synced-cart-row-price">{row.price}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : fromText.summary ? (
          <p className="synced-cart-fallback">{fromText.summary}</p>
        ) : (
          <p className="chat-row-sub">Cart updated.</p>
        )}

        {fees.length ? (
          <div className="synced-cart-fees">
            {fees
              .filter((f) => !/item total/i.test(f.label))
              .map((fee) => (
                <div
                  key={`${fee.label}-${fee.amount}`}
                  className={`synced-cart-fee ${fee.discount || fee.amount.includes('-') ? 'discount' : ''}`}
                >
                  <span>{fee.label}</span>
                  <span>{fee.amount}</span>
                </div>
              ))}
          </div>
        ) : null}

        {total ? (
          <div className="synced-cart-foot">
            <span>To pay</span>
            <strong>{total}</strong>
          </div>
        ) : null}

        {root.preview === true ? (
          <div className="chat-row-sub synced-cart-note">
            Preview only — confirm in chat to place the order.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PaymentQrFeed({ data }: { data: JsonRecord }) {
  const extracted = extractPaymentFields(data);
  const img = qrImageSrc(extracted);
  if (!extracted.pendingPayment && !extracted.placed && !img) return null;

  return (
    <div className="chat-feed-block">
      <SectionLabel>{extracted.placed ? 'Order placed' : 'Scan to pay'}</SectionLabel>
      <div className="chat-summary-card chat-qr-card">
        {extracted.pendingPayment ? (
          <p className="chat-row-sub">
            Order isn&apos;t final until payment succeeds. Scan, pay, then type &quot;I&apos;ve
            paid&quot;.
          </p>
        ) : null}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="UPI QR" className="chat-qr" />
        ) : null}
        {extracted.paymentUrl ? (
          <a href={extracted.paymentUrl} target="_blank" rel="noreferrer">
            Open payment link
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ErrorFeed({ tool }: { tool: ToolInvocationView }) {
  if (!tool.errorText) return null;
  // Hide generic noise when we already tried to show cards from the same payload.
  if (/^an error occurred\.?$/i.test(tool.errorText.trim())) return null;
  if (/output-error/i.test(tool.errorText) && tool.outputText && tool.outputText.length > 40) {
    return null;
  }
  const raw = tool.errorText.trim();
  if (/SWIGGY_TOKEN_MISSING|Invalid access token/i.test(raw)) {
    return (
      <div className="chat-soft-error">
        Your Swiggy session expired. Tap Connect Swiggy above, then try again.
      </div>
    );
  }
  // Never dump raw JSON errors into the chat surface.
  if (/^\s*[\{\[]/.test(raw) || /"error"\s*:/.test(raw)) {
    return (
      <div className="chat-soft-error">
        Something went wrong with that step. Try again in a moment.
      </div>
    );
  }
  return <div className="chat-soft-error">{stripTechnicalPayloads(raw) || raw}</div>;
}

function feedForTool(
  tool: ToolInvocationView,
  actions: WidgetActions,
): ReactNode {
  const data = asRecord(tool.outputJson);
  const text = tool.outputText || '';

  if (tool.toolName.includes('get_addresses')) {
    return <AddressesFeed data={data} text={text} actions={actions} />;
  }
  if (tool.toolName.includes('search_restaurants')) {
    return <RestaurantsFeed data={data} text={text} actions={actions} />;
  }
  if (tool.toolName.includes('search_menu') || tool.toolName.includes('get_menu')) {
    return <MenuFeed data={data} text={text} actions={actions} />;
  }
  if (
    tool.toolName.includes('manage_cart') ||
    (tool.toolName.includes('place_order') && data?.preview === true)
  ) {
    return <CartFeed data={data} text={text} />;
  }
  if (tool.toolName.includes('place_order') || tool.toolName.includes('check_payment')) {
    if (data?.blocked_by === 'kyi_warrant') {
      const deny = formatWarrantDenyUserMessage(data as WarrantDenyPayload);
      return (
        <div className="chat-soft-error warrant-deny-card" key="warrant-deny">
          <p className="warrant-deny-card__title">{deny.title}</p>
          <p className="warrant-deny-card__summary">{deny.summary}</p>
          <ul className="warrant-deny-card__suggestions">
            {deny.suggestions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      );
    }
    return data ? <PaymentQrFeed data={data} /> : null;
  }
  if (tool.toolName.includes('get_payment_options') && data) {
    return <PaymentOptionsFeed data={data} actions={actions} />;
  }
  return null;
}

/** True when this turn already renders interactive / summary cards from tools. */
export function messageHasCardFeed(message: UIMessage): boolean {
  for (const tool of toolInvocations(message)) {
    const name = tool.toolName;
    const hasOutput =
      tool.outputJson != null ||
      (typeof tool.outputText === 'string' && tool.outputText.trim().length > 8);
    if (!hasOutput) continue;
    if (
      name.includes('get_addresses') ||
      name.includes('search_restaurants') ||
      name.includes('search_menu') ||
      name.includes('get_menu') ||
      name.includes('manage_cart') ||
      name.includes('get_payment_options') ||
      name.includes('place_order') ||
      name.includes('check_payment')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitize assistant prose for the chat bubble: never show JSON, ids, or
 * duplicate lists when cards already carry the choices.
 */
export function displayAssistantText(text: string, hasCards: boolean): string {
  const raw = text.trim();
  if (!raw) return raw;

  const hadAuthError = /SWIGGY_TOKEN_MISSING|Invalid access token/i.test(raw);
  let cleaned = stripTechnicalPayloads(raw).replace(/\*\*/g, '');

  if (hasCards) {
    const lines = cleaned.split('\n');
    const kept: string[] = [];
    let skippingList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d+[\.)]\s+/.test(trimmed) || /^[-*•]\s+/.test(trimmed)) {
        skippingList = true;
        continue;
      }
      if (skippingList) {
        if (!trimmed) continue;
        if (
          /^(which|tap|pick|choose|select|please|what|where|how|scan|open|after|then)\b/i.test(
            trimmed,
          ) ||
          /\?\s*$/.test(trimmed)
        ) {
          skippingList = false;
          kept.push(trimmed);
        }
        continue;
      }
      kept.push(trimmed);
    }

    cleaned = stripTechnicalPayloads(
      kept
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
    );
  }

  if (!cleaned) {
    if (hadAuthError) {
      return 'Your Swiggy session expired. Tap Connect Swiggy above, then try again.';
    }
    return hasCards ? 'Tap an option below to continue.' : '';
  }

  // Prefer a short lead-in; cards carry the details.
  if (hasCards && cleaned.length > 180) {
    const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
    if (match?.[1] && match[1].length >= 24) return match[1].trim();
  }

  if (hadAuthError && /link|connect|token/i.test(cleaned)) {
    return 'Your Swiggy session expired. Tap Connect Swiggy above, then try again.';
  }

  return cleaned;
}

/** Hide ids in the user bubble; pick payloads still include them for the agent. */
export function displayUserText(text: string): string {
  const cleaned = stripTechnicalPayloads(text)
    .replace(/\(\s*menu_item_id\s+[^)]+\)/gi, '')
    .replace(/\(\s*restaurantId\s+[^)]+\)/gi, '')
    .replace(/\(\s*addressId\s+[^)]+\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
  return cleaned || text.trim();
}

export function ToolResultPanels({
  message,
  onPick,
  onAddToDraft,
  onSelectAddress,
  onSelectRestaurant,
  disabled,
  addressesStale,
}: {
  message: UIMessage;
  onPick?: (text: string) => void;
  onAddToDraft?: WidgetActions['onAddToDraft'];
  onSelectAddress?: WidgetActions['onSelectAddress'];
  onSelectRestaurant?: WidgetActions['onSelectRestaurant'];
  disabled?: boolean;
  /** Disable address cards in this message when a newer get_addresses exists. */
  addressesStale?: boolean;
}) {
  const tools = toolInvocations(message);
  if (!tools.length) return null;
  const actions: WidgetActions = {
    onPick,
    onAddToDraft,
    onSelectAddress,
    onSelectRestaurant,
    disabled,
    addressesStale,
  };

  const nodes: ReactNode[] = [];
  let renderedUseful = false;
  /** Merge all search_menu / get_menu results into one carousel (avoids double "Menu picks"). */
  const menuRows: MenuRow[] = [];
  let menuKey = 'menu';

  for (const tool of tools) {
    if (tool.toolName.includes('search_menu') || tool.toolName.includes('get_menu')) {
      menuRows.push(
        ...parseMenuRowsFromData(asRecord(tool.outputJson), tool.outputText || ''),
      );
      menuKey = tool.id;
      continue;
    }
    const node = feedForTool(tool, actions);
    if (node) {
      nodes.push(<div key={tool.id}>{node}</div>);
      renderedUseful = true;
    }
  }

  const uniqueMenu = dedupeMenuRows(menuRows);
  if (uniqueMenu.length) {
    nodes.unshift(
      <div key={`menu-${menuKey}`}>
        <MenuFeed rows={uniqueMenu} actions={actions} />
      </div>,
    );
    renderedUseful = true;
  }

  if (!renderedUseful) {
    for (const tool of tools) {
      if (tool.state !== 'output-error') continue;
      const errNode = ErrorFeed({ tool });
      if (errNode) nodes.push(<div key={`err-${tool.id}`}>{errNode}</div>);
    }
  }

  if (!nodes.length) return null;
  return <div className="chat-tool-feed">{nodes}</div>;
}

export function latestPendingPayment(messages: UIMessage[]): JsonRecord | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    for (const tool of toolInvocations(message).reverse()) {
      const data = asRecord(tool.outputJson);
      if (!data) continue;
      const extracted = extractPaymentFields(data);
      if (
        extracted.pendingPayment &&
        (extracted.paymentUrl ||
          extracted.paymentQrImage ||
          extracted.paymentQrPayload ||
          extracted.paasId)
      ) {
        return {
          ...data,
          paymentUrl: extracted.paymentUrl,
          paymentQrImage: extracted.paymentQrImage,
          paymentQrPayload: extracted.paymentQrPayload,
          paasId: extracted.paasId,
          order_id: extracted.orderId,
          pendingPayment: true,
        };
      }
    }
  }
  return null;
}

/** Message id of the most recent successful get_addresses tool output. */
export function latestAddressesMessageId(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role === 'user') continue;
    for (const tool of toolInvocations(message).reverse()) {
      if (!tool.toolName.includes('get_addresses')) continue;
      const hasOutput =
        tool.outputJson != null ||
        (typeof tool.outputText === 'string' && tool.outputText.trim().length > 8);
      if (hasOutput) return message.id;
    }
  }
  return null;
}

/** True when tool text/json looks like Swiggy rejected the addressId. */
export function isAddressNotFoundPayload(
  outputJson: unknown,
  outputText?: string,
  errorText?: string,
): boolean {
  const blob = [
    typeof outputText === 'string' ? outputText : '',
    typeof errorText === 'string' ? errorText : '',
    outputJson != null ? JSON.stringify(outputJson) : '',
  ]
    .join(' ')
    .toLowerCase();
  if (!blob.trim()) return false;
  return (
    /address with id\b/.test(blob) && /not found/.test(blob)
  ) || /address(?:id)?\b.{0,40}\b(not found|invalid|does not exist|no longer)/i.test(blob);
}

/**
 * Scan chat for the latest manage_cart / place_order failure about a bad address.
 * Returns a stable key so callers can react once per failure.
 */
export function latestAddressFailureKey(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    for (const tool of toolInvocations(message).reverse()) {
      const name = tool.toolName;
      if (!name.includes('manage_cart') && !name.includes('place_order')) continue;
      if (
        isAddressNotFoundPayload(tool.outputJson, tool.outputText, tool.errorText)
      ) {
        return `${message.id}:${tool.id}:address-not-found`;
      }
    }
  }
  return null;
}

/** Latest user address card pick: `Use address N: Label (addressId xxx)`. */
export function latestPickedAddressFromMessages(
  messages: UIMessage[],
): { id: string; label: string; messageId: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== 'user') continue;
    const text = message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('');
    const idMatch = text.match(/\baddressId\s+([A-Za-z0-9_-]+)/i);
    if (!idMatch?.[1]) continue;
    const labelMatch = text.match(
      /Use address\s+\d+\s*:\s*(.+?)\s*\(\s*addressId/i,
    );
    return {
      id: idMatch[1],
      label: (labelMatch?.[1] || 'Selected address').trim(),
      messageId: message.id,
    };
  }
  return null;
}
