'use client';

import {
  itemLikelyNeedsSize,
  sizeChoicesForItem,
  useDraftCart,
} from '@/lib/draft-cart';

export function DraftCartChrome({
  disabled,
  onConfirm,
}: {
  disabled?: boolean;
  onConfirm: (message: string) => void;
}) {
  const cart = useDraftCart();
  if (cart.itemCount === 0 && !cart.cartOpen) return null;

  const sizeBlocked = cart.missingSizeCount > 0;
  // Only hard-block sync after Swiggy rejected the address — never hide Sync for a soft miss.
  const addressBlocked = cart.addressInvalid;
  const syncBlocked = sizeBlocked || addressBlocked;

  let syncTitle: string | undefined;
  if (sizeBlocked) syncTitle = 'Choose a size for each item first';
  else if (addressBlocked) syncTitle = 'Address was rejected — refresh and pick again first';

  let statusClass = 'draft-cart-bar-sub';
  let statusText = 'Not synced yet';
  if (sizeBlocked) {
    statusClass = 'draft-cart-bar-warn';
    statusText = 'Pick size in draft';
  } else if (addressBlocked) {
    statusClass = 'draft-cart-bar-warn';
    statusText = 'Address expired — pick again';
  } else if (cart.addressLabel) {
    statusText = `To ${cart.addressLabel}`;
  }

  return (
    <>
      {cart.itemCount > 0 ? (
        <div className="draft-cart-bar">
          <div className="draft-cart-bar-meta">
            <strong>
              Draft · {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
            </strong>
            {cart.restaurantName ? (
              <span className="draft-cart-bar-sub">{cart.restaurantName}</span>
            ) : null}
            {cart.estimatedTotal > 0 ? (
              <span className="draft-cart-bar-total">
                Est. ₹{Math.round(cart.estimatedTotal)}
              </span>
            ) : null}
            <span className={statusClass}>{statusText}</span>
          </div>
          <div className="draft-cart-bar-actions">
            <button
              type="button"
              className="chat-btn"
              onClick={() => cart.setCartOpen(true)}
            >
              View draft
            </button>
            {addressBlocked ? (
              <button
                type="button"
                className="chat-btn"
                disabled={disabled}
                onClick={() => onConfirm(cart.buildRefreshAddressMessage())}
              >
                Refresh addresses
              </button>
            ) : null}
            <button
              type="button"
              className="chat-btn chat-btn-primary"
              disabled={disabled || cart.itemCount === 0 || syncBlocked}
              title={syncTitle}
              onClick={() => {
                onConfirm(cart.buildConfirmMessage());
              }}
            >
              Sync to order
            </button>
          </div>
        </div>
      ) : null}

      {cart.cartOpen ? (
        <div className="draft-cart-overlay" role="dialog" aria-label="Your cart">
          <button
            type="button"
            className="draft-cart-scrim"
            aria-label="Close cart"
            onClick={() => cart.setCartOpen(false)}
          />
          <div className="draft-cart-sheet">
            <div className="draft-cart-sheet-head">
              <div>
                <div className="draft-cart-sheet-title">Draft cart</div>
                {cart.restaurantName ? (
                  <div className="draft-cart-sheet-sub">{cart.restaurantName}</div>
                ) : null}
                {cart.addressInvalid ? (
                  <div className="draft-cart-bar-warn">
                    Previous address was rejected by Swiggy — refresh and pick again.
                  </div>
                ) : cart.addressLabel ? (
                  <div className="draft-cart-sheet-sub">Deliver to {cart.addressLabel}</div>
                ) : (
                  <div className="draft-cart-sheet-sub">
                    Address will use your latest pick in chat if not set here.
                  </div>
                )}
              </div>
              <button
                type="button"
                className="chat-btn"
                onClick={() => cart.setCartOpen(false)}
              >
                Close
              </button>
            </div>

            {cart.items.length === 0 ? (
              <p className="draft-cart-empty">
                Your draft is empty. Add dishes from the menu, then sync to place an order.
              </p>
            ) : (
              <ul className="draft-cart-list">
                {cart.items.map((row) => {
                  const lineTotal =
                    row.unitPrice != null ? row.unitPrice * row.quantity : undefined;
                  const sizes = sizeChoicesForItem(row);
                  const needsSize = itemLikelyNeedsSize(row);
                  return (
                    <li key={row.key} className="draft-cart-row">
                      <div className="draft-cart-row-main">
                        <div className="draft-cart-row-title">
                          {row.name}
                          {row.size ? <span> · {row.size}</span> : null}
                        </div>
                        {lineTotal != null ? (
                          <div className="draft-cart-row-price">₹{Math.round(lineTotal)}</div>
                        ) : null}
                      </div>

                      {sizes.length > 0 ? (
                        <div className="draft-size-block">
                          <div className="draft-size-label">
                            {needsSize ? 'Choose size' : 'Size'}
                          </div>
                          <div className="chat-size-chips" role="group" aria-label={`Size for ${row.name}`}>
                            {sizes.map((size) => (
                              <button
                                key={size}
                                type="button"
                                className={
                                  row.size === size
                                    ? 'chat-size-chip chat-size-chip-active'
                                    : 'chat-size-chip'
                                }
                                disabled={disabled}
                                onClick={() => cart.setItemSize(row.key, size)}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="draft-cart-row-actions">
                        <div className="draft-qty">
                          <button
                            type="button"
                            className="draft-qty-btn"
                            aria-label="Decrease quantity"
                            onClick={() => cart.setQuantity(row.key, row.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{row.quantity}</span>
                          <button
                            type="button"
                            className="draft-qty-btn"
                            aria-label="Increase quantity"
                            onClick={() => cart.setQuantity(row.key, row.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="draft-remove"
                          onClick={() => cart.removeItem(row.key)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="draft-cart-sheet-foot">
              <div className="draft-cart-sheet-total">
                {sizeBlocked ? (
                  <span className="draft-cart-bar-warn">
                    Tap a size (250 g / 500 g / 1 kg) above, then sync.
                  </span>
                ) : addressBlocked ? (
                  <span className="draft-cart-bar-warn">
                    Refresh addresses and tap a delivery card, then sync.
                  </span>
                ) : cart.estimatedTotal > 0 ? (
                  <>
                    Estimated total <strong>₹{Math.round(cart.estimatedTotal)}</strong>
                  </>
                ) : (
                  <span>Totals finalize after sync with Swiggy</span>
                )}
              </div>
              <div className="draft-cart-bar-actions" style={{ justifyContent: 'flex-end' }}>
                {addressBlocked ? (
                  <button
                    type="button"
                    className="chat-btn"
                    disabled={disabled}
                    onClick={() => {
                      onConfirm(cart.buildRefreshAddressMessage());
                      cart.setCartOpen(false);
                    }}
                  >
                    Refresh addresses
                  </button>
                ) : null}
                <button
                  type="button"
                  className="chat-btn chat-btn-primary draft-confirm-btn"
                  disabled={disabled || cart.items.length === 0 || syncBlocked}
                  title={syncTitle}
                  onClick={() => {
                    onConfirm(cart.buildConfirmMessage());
                    cart.setCartOpen(false);
                  }}
                >
                  Confirm & sync to order
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
