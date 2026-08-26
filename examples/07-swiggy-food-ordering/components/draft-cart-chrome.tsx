'use client';

import { useDraftCart } from '@/lib/draft-cart';

export function DraftCartChrome({
  disabled,
  onConfirm,
}: {
  disabled?: boolean;
  onConfirm: (message: string) => void;
}) {
  const cart = useDraftCart();
  if (cart.itemCount === 0 && !cart.cartOpen) return null;

  return (
    <>
      {cart.itemCount > 0 ? (
        <div className="draft-cart-bar">
          <div className="draft-cart-bar-meta">
            <strong>
              {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
            </strong>
            {cart.restaurantName ? (
              <span className="draft-cart-bar-sub">{cart.restaurantName}</span>
            ) : null}
            {cart.estimatedTotal > 0 ? (
              <span className="draft-cart-bar-total">
                Est. ₹{Math.round(cart.estimatedTotal)}
              </span>
            ) : null}
          </div>
          <div className="draft-cart-bar-actions">
            <button
              type="button"
              className="chat-btn"
              onClick={() => cart.setCartOpen(true)}
            >
              View cart
            </button>
            <button
              type="button"
              className="chat-btn chat-btn-primary"
              disabled={disabled || cart.itemCount === 0}
              onClick={() => {
                cart.setCartOpen(true);
              }}
            >
              Confirm & show cart
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
                <div className="draft-cart-sheet-title">Your cart</div>
                {cart.restaurantName ? (
                  <div className="draft-cart-sheet-sub">{cart.restaurantName}</div>
                ) : null}
                {cart.addressLabel ? (
                  <div className="draft-cart-sheet-sub">Deliver to {cart.addressLabel}</div>
                ) : null}
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
              <p className="draft-cart-empty">Your draft cart is empty. Add dishes from the menu.</p>
            ) : (
              <ul className="draft-cart-list">
                {cart.items.map((row) => {
                  const lineTotal =
                    row.unitPrice != null ? row.unitPrice * row.quantity : undefined;
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
                {cart.estimatedTotal > 0 ? (
                  <>
                    Estimated total <strong>₹{Math.round(cart.estimatedTotal)}</strong>
                  </>
                ) : (
                  <span>Totals finalize after sync with Swiggy</span>
                )}
              </div>
              <button
                type="button"
                className="chat-btn chat-btn-primary draft-confirm-btn"
                disabled={disabled || cart.items.length === 0}
                onClick={() => {
                  const message = cart.buildConfirmMessage();
                  onConfirm(message);
                  cart.setCartOpen(false);
                }}
              >
                Confirm & sync cart
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
