/* gift-guide.js — Ecomexperts test (vanilla JS only)
 *
 * What this script does:
 * 1) Opens a product popup when a grid item is clicked.
 *    - Works with elements that have [data-product-handle] (recommended)
 *    - OR elements that have [data-product-json] (stringified product JSON)
 * 2) Renders Color (buttons with left swatch) + Size (dropdown) from real variant data.
 * 3) Resolves the selected variant and shows the correct price.
 * 4) Adds to cart via POST /cart/add.js
 * 5) If Color === "Black" and Size === "Medium" (or "M"), also auto-adds “Soft Winter Jacket”.
 *
 * Minimal HTML assumptions in your grid section (gift-guide-product-grid.liquid):
 *   <div id="gift-guide-grid" data-bonus-handle="soft-winter-jacket">
 *     <article class="gg-card" data-product-handle="{{ product.handle }}">
 *        ...your image etc...
 *     </article>
 *     ...
 *   </div>
 *
 * If you prefer to pass full product JSON (faster, no extra GET):
 *   <article class="gg-card" data-product-json='{{ product | json | escape }}'></article>
 *
 * The script auto-creates the popup markup and appends it to <body>.
 */

(() => {
  // ----------------------- CONFIG -----------------------
  const GRID_SELECTOR = '#gift-guide-grid'; // container of the 6 product blocks
  const CARD_SELECTOR = '.gg-card, [data-product-handle], [data-product-json]';
  const BONUS_PRODUCT_HANDLE_FALLBACK = 'soft-winter-jacket'; // change if your handle differs

  // -------------------- HELPERS -------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const moneyFormat = (cents) => {
    // Prefer Shopify.formatMoney if available; fallback to a basic formatter.
    try {
      if (window.Shopify && typeof Shopify.formatMoney === 'function') {
        return Shopify.formatMoney(cents);
      }
    } catch (_) {}
    const value = (Number(cents) || 0) / 100;
    try {
      // Try to read store currency
      const cur = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD';
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(value);
    } catch (_) {
      return `$${value.toFixed(2)}`;
    }
  };

  const norm = (s) => String(s || '').trim().toLowerCase();

  // Treat "M" == "Medium", "L" == "Large", etc.
  const normalizeSize = (s) => {
    const n = norm(s);
    if (n === 'm' || n === 'med' || n === 'medium') return 'medium';
    if (n === 's' || n === 'small') return 'small';
    if (n === 'l' || n === 'large') return 'large';
    if (n === 'xl' || n === 'extra large' || n === 'x-large') return 'xl';
    if (n === 'xs' || n === 'extra small' || n === 'x-small') return 'xs';
    return n;
  };

  // Try to convert color words/hex to a CSS color string.
  const colorMap = {
    black: '#000000',
    white: '#ffffff',
    blue: 'blue',
    red: 'red',
    grey: 'gray',
    gray: 'gray',
    silver: '#c0c0c0',
    brown: '#8b4513',
    green: 'green',
    yellow: 'yellow',
    pink: 'pink',
    purple: 'purple',
    beige: '#f5f5dc',
    navy: 'navy',
    maroon: 'maroon',
  };
  const toCssColor = (val) => {
    const v = String(val || '').trim();
    // hex
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
    // "Blue Silk" → "blue"
    const first = v.split(/\s|-/)[0].toLowerCase();
    return colorMap[first] || first || '#000';
  };

  const getBonusHandle = () => {
    const grid = $(GRID_SELECTOR);
    return (grid && grid.getAttribute('data-bonus-handle')) || BONUS_PRODUCT_HANDLE_FALLBACK;
  };

  const fetchProductByHandle = async (handle) => {
    const res = await fetch(`/products/${handle}.js`);
    if (!res.ok) throw new Error(`Failed to fetch product: ${handle}`);
    return await res.json();
  };

  const addVariantToCart = async (variantId, qty = 1) => {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: qty })
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Add to cart failed (${res.status}): ${t}`);
    }
    return await res.json();
  };

  // -------------------- POPUP MARKUP --------------------
  const injectPopupShell = () => {
    if ($('#gg-overlay')) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="gg-overlay" class="gg-overlay" hidden>
        <div class="gg-modal" role="dialog" aria-modal="true" aria-labelledby="gg-title">
          <button class="gg-close" type="button" aria-label="Close dialog">×</button>
          <div class="gg-content">
            <div class="gg-media">
              <img class="gg-image" alt="" />
            </div>
            <div class="gg-info">
              <h3 id="gg-title" class="gg-title"></h3>
              <div class="gg-price" data-el="price"></div>
              <p class="gg-desc" data-el="desc"></p>

              <div class="gg-field" data-el="color-field" hidden>
                <label class="gg-label">Color</label>
                <div class="gg-colors" data-el="colors"></div>
              </div>

              <div class="gg-field" data-el="size-field" hidden>
                <label class="gg-label">Size</label>
                <div class="gg-select-wrap">
                  <select class="gg-select" data-el="size-select">
                    <option value="">Choose your size</option>
                  </select>
                  <span class="gg-caret" aria-hidden="true">▾</span>
                </div>
              </div>

              <button type="button" class="gg-atc" disabled>
                <span>ADD TO CART</span>
                <svg class="gg-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="gg-note" data-el="note" role="status" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);
  };

  const openPopup = () => { $('#gg-overlay').hidden = false; document.body.classList.add('gg-no-scroll'); };
  const closePopup = () => { $('#gg-overlay').hidden = true; document.body.classList.remove('gg-no-scroll'); };

  // ------------------ STATE & RENDER --------------------
  let currentProduct = null;        // product JSON from /products/handle.js
  let selected = Object.create(null); // { optionNameLower: "Value" }
  let selectedVariant = null;

  const resetState = () => {
    currentProduct = null;
    selected = Object.create(null);
    selectedVariant = null;
    const atc = $('.gg-atc');
    if (atc) atc.disabled = true;
  };

  const mapOptionsByName = (product) => {
    // returns: { color: {...}, size: {...}, ... }
    const map = {};
    product.options.forEach((name, idx) => {
      map[norm(name)] = {
        index: idx,                   // index in variant.options
        name,
        values: Array.from(new Set(product.variants.map(v => v.options[idx]))),
      };
    });
    return map;
  };

  const renderFromProduct = (product) => {
    currentProduct = product;
    const o = mapOptionsByName(product);

    // Fill static UI
    $('.gg-title').textContent = product.title || '';
    $('.gg-image').src = (product.featured_image || (product.images && product.images[0]) || '').replace('.jpg', '_400x.jpg');
    $('.gg-image').alt = product.title || '';
    $('.gg-desc').textContent = (product.description || '').replace(/<[^>]*>/g, '').trim();
    const priceCents = (product.variants && product.variants[0] && product.variants[0].price) || 0;
    $('[data-el="price"]').textContent = moneyFormat(priceCents);

    // COLORS
    const colorOpt = o['color'] || o['colour'];
    const colorsWrap = $('[data-el="colors"]');
    const colorField = $('[data-el="color-field"]');
    colorsWrap.innerHTML = '';
    if (colorOpt && colorOpt.values.length) {
      colorField.hidden = false;
      colorOpt.values.forEach(val => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gg-color';
        btn.dataset.value = val;
        btn.style.setProperty('--swatch', toCssColor(val));
        btn.innerHTML = `<span class="gg-color__text">${val}</span>`;
        btn.addEventListener('click', () => {
          $$('.gg-color').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          selected[norm(colorOpt.name)] = val;
          resolveVariant();
        });
        colorsWrap.appendChild(btn);
      });
      // preselect first color
      const first = colorsWrap.querySelector('.gg-color');
      if (first) first.click();
    } else {
      colorField.hidden = true;
      delete selected['color']; delete selected['colour'];
    }

    // SIZES (dropdown)
    const sizeOpt = o['size'];
    const sizeSelect = $('[data-el="size-select"]');
    const sizeField = $('[data-el="size-field"]');
    sizeSelect.innerHTML = `<option value="">Choose your size</option>`;
    if (sizeOpt && sizeOpt.values.length) {
      sizeField.hidden = false;
      sizeOpt.values.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        sizeSelect.appendChild(opt);
      });
      sizeSelect.addEventListener('change', () => {
        selected[norm(sizeOpt.name)] = sizeSelect.value || null;
        resolveVariant();
      });
    } else {
      sizeField.hidden = true;
      delete selected['size'];
    }

    // If product has neither color nor size, still resolve first variant.
    resolveVariant();
  };

  const resolveVariant = () => {
    const optNames = currentProduct.options.map((n) => norm(n));
    // Build an array in the order of product.options, each may be null
    const want = optNames.map(name => selected[name] || null);

    // Find first variant that matches chosen options (ignoring nulls)
    selectedVariant = currentProduct.variants.find(v => {
      return v.options.every((val, i) => !want[i] || norm(val) === norm(want[i]));
    }) || null;

    // Update price + enable ATC only when all required chosen and variant available
    if (selectedVariant) {
      $('[data-el="price"]').textContent = moneyFormat(selectedVariant.price);
    }
    const needsChoice = optNames.some(n => !!(currentProduct.options.length && !selected[n]));
    $('.gg-atc').disabled = needsChoice || !selectedVariant || !selectedVariant.available;

    // Feedback note
    const note = $('[data-el="note"]');
    if (selectedVariant && !selectedVariant.available) {
      note.textContent = 'This variant is currently unavailable.';
    } else {
      note.textContent = '';
    }
  };

  const attachGlobalEvents = () => {
    const overlay = $('#gg-overlay');
    $('.gg-close').addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closePopup();
    });

    $('.gg-atc').addEventListener('click', async () => {
      if (!selectedVariant) return;

      const colorName = (selected['color'] || selected['colour'] || '').toString();
      const sizeName = (selected['size'] || '').toString();
      const isBlack = norm(colorName) === 'black';
      const isMedium = normalizeSize(sizeName) === 'medium';

      const atcBtn = $('.gg-atc');
      const note = $('[data-el="note"]');
      atcBtn.disabled = true;

      try {
        // 1) Add selected variant
        await addVariantToCart(selectedVariant.id, 1);

        // 2) Conditional add "Soft Winter Jacket"
        if (isBlack && isMedium) {
          const bonusHandle = getBonusHandle();
          const bonus = await fetchProductByHandle(bonusHandle);
          // pick first available variant
          const bonusVariant = bonus.variants.find(v => v.available) || bonus.variants[0];
          if (bonusVariant) await addVariantToCart(bonusVariant.id, 1);
        }

        note.textContent = 'Added to cart.';
        // keep open; if you want to close: closePopup();
      } catch (err) {
        note.textContent = 'Add to cart failed. Please try again.';
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        atcBtn.disabled = false;
      }
    });
  };

  const wireGrid = () => {
  const grid = $(GRID_SELECTOR);
  if (!grid) return;

  grid.addEventListener('click', async (evt) => {
    const card = evt.target.closest(CARD_SELECTOR) 
              || evt.target.closest('a[href*="/products/"]'); 
    if (!card) return;

    evt.preventDefault();
    resetState();

    try {
      let product;
      const json = card.getAttribute('data-product-json');
      if (json) {
        product = JSON.parse(json);
      } else {
        // Extract handle: either data attribute or href
        let handle = card.getAttribute('data-product-handle');
        if (!handle) {
          const link = card.getAttribute('href') 
                    || (card.querySelector('a[href*="/products/"]')?.getAttribute('href'));
          if (link) {
            const match = link.match(/\/products\/([\w-]+)/);
            if (match) handle = match[1];
          }
        }
        if (!handle) return;
        product = await fetchProductByHandle(handle);
      }

      renderFromProduct(product);
      openPopup();
    } catch (err) {
      console.error("Popup open failed:", err);
    }
  });
};


  // -------------------- INIT ----------------------------
  document.addEventListener('DOMContentLoaded', () => {
    injectPopupShell();
    attachGlobalEvents();
    wireGrid();
  });
})();
