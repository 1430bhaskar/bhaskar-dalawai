/* Gift Guide — popup + dynamic variants + AJAX cart (no jQuery)
   -------------------------------------------------------------
   - Opens modal on grid tile click (or Enter key)
   - Fetches /products/<handle>.js
   - Renders option values from variants (unique per option index)
   - Keeps track of selected options; finds the matching variant
   - Updates price on selection
   - Adds to cart via /cart/add.js
   - Rule: if selected options contain Color=Black and Size=Medium,
           also add upsell product (handle from data-upsell-handle)
   - ESC closes; click outside closes; focus is trapped in modal
*/

(function () {
  const gridSection = document.querySelector('.gift-guide-grid-section');
  if (!gridSection) return;

  const moneyFormat = gridSection.dataset.moneyFormat || '${{amount}}';
  const UPSELL_HANDLE = gridSection.dataset.upsellHandle || 'soft-winter-jacket';

  // ---------- Helpers ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function formatMoney(cents) {
    const value = (cents / 100).toFixed(2);
    // basic {{amount}} replacement
    if (moneyFormat.indexOf('{{') >= 0) {
      return moneyFormat.replace(/{{\s*amount(?:_no_decimals)?\s*}}/, value);
    }
    return '$' + value;
  }

  function halt(e) { e.preventDefault(); e.stopPropagation(); }

  function uniqueValuesForOption(product, index) {
    const key = 'option' + (index + 1);
    const vals = new Set();
    product.variants.forEach(v => vals.add(v[key]));
    return Array.from(vals);
  }

  function getVariantByOptions(product, selected) {
    // selected: array of option values at index positions (may be null)
    const match = product.variants.find(v =>
      selected.every((val, idx) => (val == null) ? true : v['option' + (idx + 1)] === val)
    );
    return match || product.variants[0];
  }

  function textSlice(str, n) {
    if (!str) return '';
    const s = str.replace(/<[^>]*>/g, ''); // strip HTML for safety
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  // ---------- Modal plumbing ----------
  const modal = $('#gg-modal');
  const dialog = $('.gg-modal__dialog', modal);
  const body = $('.gg-modal__body', modal);
  const closeBtn = $('.gg-modal__close', modal);
  let lastFocus = null;

  function openModal() {
    modal.classList.remove('gg-is-hidden');
    modal.setAttribute('aria-hidden', 'false');
    lastFocus = document.activeElement;
    // focus trap start
    setTimeout(() => closeBtn.focus(), 0);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('gg-is-hidden');
    modal.setAttribute('aria-hidden', 'true');
    body.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  // close interactions
  closeBtn.addEventListener('click', () => closeModal());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('gg-is-hidden')) return;
    if (e.key === 'Escape') closeModal();
  });

  // ---------- Grid interactions ----------
  $$('.gg-card[data-handle]').forEach(card => {
    const open = () => loadProduct(card.dataset.handle);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { halt(e); open(); }
    });
  });

  // ---------- Product rendering ----------
  function loadProduct(handle) {
    fetch(`/products/${handle}.js`)
      .then(r => r.json())
      .then(product => renderProduct(product))
      .catch(() => alert('Could not load product. Please try again.'));
  }

  function renderProduct(product) {
    // compute option sets
    const optionNames = product.options || [];
    const optionValues = optionNames.map((_, idx) => uniqueValuesForOption(product, idx));

    // initial selection: first variant
    const selected = optionNames.map((_, i) => product.variants[0]['option' + (i + 1)] || null);

    // markup
    const priceNow = formatMoney(product.variants[0].price);
    const img = product.featured_image || (product.images && product.images[0]) || '';

    body.innerHTML = `
      <div class="gg-p-left">
        ${img ? `<img src="${img}" alt="${product.title}">` : ''}
      </div>
      <div class="gg-p-right">
        <h3 class="gg-p-title">${product.title}</h3>
        <div class="gg-p-price" id="gg-price">${priceNow}</div>
        <div class="gg-p-desc">${textSlice(product.description || product.title, 500)}</div>

        <div class="gg-variants">
          ${optionNames.map((name, idx) => {
            const vals = optionValues[idx];
            // Use buttons when <= 6 items; otherwise a select field
            if (vals.length <= 6) {
              return `
                <div class="gg-variant-row" data-idx="${idx}">
                  <div class="gg-variant-label">${name}</div>
                  <div class="gg-opts">
                    ${vals.map(v => `
                      <button class="gg-opt" type="button"
                        data-idx="${idx}" data-value="${v}"
                        aria-pressed="${v === selected[idx] ? 'true' : 'false'}">${v}</button>
                    `).join('')}
                  </div>
                </div>
              `;
            } else {
              return `
                <div class="gg-variant-row" data-idx="${idx}">
                  <label class="gg-variant-label" for="gg-select-${idx}">${name}</label>
                  <select id="gg-select-${idx}" class="gg-select" data-idx="${idx}">
                    ${vals.map(v => `<option value="${v}" ${v === selected[idx] ? 'selected' : ''}>${v}</option>`).join('')}
                  </select>
                </div>
              `;
            }
          }).join('')}
        </div>

        <button id="gg-add" class="gg-add">
          ADD TO CART
          <span class="gg-add__arrow" aria-hidden="true">→</span>
        </button>
        <div id="gg-msg" class="gg-msg" role="status" aria-live="polite"></div>
      </div>
    `;

    wireVariantUI(product, selected);
    openModal();
  }

  // ---------- Variants UI logic ----------
  function wireVariantUI(product, selected) {
    const priceEl = $('#gg-price', body);
    const addBtn = $('#gg-add', body);
    const msg = $('#gg-msg', body);

    function updatePrice() {
      const v = getVariantByOptions(product, selected);
      priceEl.textContent = formatMoney(v.price);
      addBtn.disabled = !v.available;
      addBtn.dataset.variantId = v.id;
    }
    updatePrice();

    // button sets
    $$('.gg-opt', body).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        selected[idx] = btn.dataset.value;
        // toggle pressed in this row
        $$('.gg-opt[data-idx="' + idx + '"]', body).forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        updatePrice();
      });
    });

    // selects
    $$('.gg-select', body).forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.idx, 10);
        selected[idx] = sel.value;
        updatePrice();
      });
    });

    // add to cart
    addBtn.addEventListener('click', () => {
      const id = Number(addBtn.dataset.variantId);
      if (!id) return;

      addBtn.disabled = true; msg.textContent = 'Adding…';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: 1 })
      })
      .then(r => {
        if (!r.ok) throw new Error('Add failed');
        return r.json();
      })
      .then(() => {
        msg.textContent = 'Added to cart!';
        // Special rule: if Color=Black and Size=Medium → add upsell
        const colorIdx = (product.options || []).indexOf('Color');
        const sizeIdx  = (product.options || []).indexOf('Size');

        const color = colorIdx >= 0 ? (selected[colorIdx] || '') : '';
        const size  = sizeIdx  >= 0 ? (selected[sizeIdx]  || '') : '';

        if (color.toLowerCase() === 'black' && size.toLowerCase() === 'medium') {
          fetch(`/products/${UPSELL_HANDLE}.js`)
            .then(r => r.json())
            .then(up => {
              if (!up || !up.variants || !up.variants.length) return;
              return fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: up.variants[0].id, quantity: 1 })
              });
            })
            .catch(() => {/* silently ignore upsell errors */});
        }

        // auto close after short delay
        setTimeout(closeModal, 900);
      })
      .catch(() => {
        msg.textContent = 'Failed to add. Please try again.';
      })
      .finally(() => {
        addBtn.disabled = false;
      });
    });
  }
})();
