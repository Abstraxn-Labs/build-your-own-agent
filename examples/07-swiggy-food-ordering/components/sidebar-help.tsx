'use client';

import { useState } from 'react';

export function SidebarHelp({
  capabilityLabels,
  docsUrl,
}: {
  capabilityLabels: Record<string, string>;
  docsUrl: string;
}) {
  const [howOpen, setHowOpen] = useState(true);
  const [highlightsOpen, setHighlightsOpen] = useState(false);

  return (
    <div className="side-help-stack">
      <section className="side-help-section">
        <button
          type="button"
          className="side-help-toggle"
          aria-expanded={howOpen}
          onClick={() => setHowOpen((open) => !open)}
        >
          <span className="side-help-toggle-label">How it works</span>
          <span className="side-help-chevron" aria-hidden>
            {howOpen ? '−' : '+'}
          </span>
        </button>
        {howOpen ? (
          <ol className="side-copy side-help-body">
            <li>Choose a delivery address</li>
            <li>Add dishes to your draft cart</li>
            <li>Confirm &amp; pay with UPI</li>
            <li>Type &quot;I&apos;ve paid&quot; after scanning</li>
          </ol>
        ) : null}
      </section>

      <section className="side-help-section">
        <button
          type="button"
          className="side-help-toggle"
          aria-expanded={highlightsOpen}
          onClick={() => setHighlightsOpen((open) => !open)}
        >
          <span className="side-help-toggle-label">Highlights</span>
          <span className="side-help-chevron" aria-hidden>
            {highlightsOpen ? '−' : '+'}
          </span>
        </button>
        {highlightsOpen ? (
          <ul className="side-capabilities side-help-body">
            {[
              'swiggy_search_restaurants',
              'swiggy_get_menu',
              'swiggy_manage_cart',
              'swiggy_place_order',
              'swiggy_check_payment_status',
            ].map((capability) => (
              <li key={capability}>
                <span className="side-cap-mark" aria-hidden />
                {capabilityLabels[capability] ?? capability}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="side-docs">
        Docs:{' '}
        <a href={docsUrl} target="_blank" rel="noreferrer">
          MCP integration
        </a>
      </p>
    </div>
  );
}
