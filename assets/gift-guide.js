/* gift-guide.js
   - Dynamic modal product fetch
   - Renders variants from product JSON
   - Finds matching variant id from selected options
   - Adds item via AJAX POST to /cart/add.js
   - Special rule: if selected options include Color=Black and Size=Medium,
     also add the product with handle UPSELL_PRODUCT_HANDLE to the cart automatically.
   - No jQuery. Vanilla JS only.
*/

(function () {
  const SECTION = document.querySelector('.gift-guide-grid-section');
  if (!SECTION) return;

  const modal = document.getElementById('gg-modal');
  const modalBody = modal.querySelector('.gg-modal__body');
  const closeBtn = modal.querySelector('.gg-modal__close');
  const UPSELL_PRODUCT_HANDLE = SECTION.dataset.upsellHandle || 'soft-winter-jacket';
  const moneyFormat = SECTION.dataset.moneyFormat || '${{amount}}';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function formatMoney(cents) {
    if (cents == null) return '';
    const value = (cents / 100).toFixed(2);
    if (moneyFormat.indexOf('{{') >= 0) {
      return moneyFormat.replace(/{{\s*amount(?:_no_decimals)?\s*}}/, value);
    }
    return '$' + value;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function uniqueValuesForOption(product, index) {
    const key = 'option' + (index + 1);
    const vals = new Set();
    product.variants.forEach(v => vals.add(v[key]));
    return Array.from(vals);
  }

  function getVariantByOptions(product, selected) {
    const match = product.variants.find(v =>
      selected.every((val, idx) => (val == null) ? true : v['option' + (idx + 1)] === val)
    );
    return match || product.variants[0];
  }

  function openModal() {
    modal.classList.remove('gg-is-hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => closeBtn.focus(), 0);
  }

  function closeModal() {
    modal.classList.add('gg-is-hidden');
    modal.setAttribute('aria-hidden', 'true');
    modalBody.innerHTML = '';
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (modal.classList.contains('gg-is-hidden')) return;
    if (e.key === 'Escape') closeModal();
  });

  // Open modal when card clicked or Enter/Space pressed
  $$('.gg-card[data-handle]').forEach(card => {
    const open = () => loadProduct(card.dataset.handle);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  function loadProduct(handle) {
    fetch(`/products/${handle}.js`)
      .then(res => {
        if (!res.ok) throw new Error('fetch error');
        return res.json();
      })
      .then(product => renderProduct(product))
      .catch(err => {
        console.error(err);
        alert('Could not load product. Try again.');
      });
  }

  function textSlice(str, n) {
    if (!str) return '';
    const s = str.replace(/<[^>]*>/g, '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function renderProduct(product) {
    const optionNames = product.options || [];
    const optionValues = optionNames.map((_, idx) => uniqueValuesForOption(product, idx));
    const selected = optionNames.map((_, i) => product.variants[0]['option' + (i + 1)] || null);

    const img = product.featured_image || (product.images && product.images[0]) || '';
    const priceNow = formatMoney(product.variants[0].price);

    modalBody.innerHTML = `
      <div class="modal-product">
        <div class="left">
          ${ img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(product.title)}">` : '' }
        </div>
        <div class="right">
          <h2 class="gg-p-title">${escapeHtml(product.title)}</h2>
          <div class="gg-p-price" id="gg-price">${priceNow}</div>
          <div class="gg-p-desc">${escapeHtml(textSlice(product.description || product.title, 800))}</div>

          <div class="gg-variants">
            ${optionNames.map((name, idx) => {
              const vals = optionValues[idx];
              if (vals.length <= 6) {
                return `<div class="gg-variant-row" data-idx="${idx}">
                  <div class="gg-variant-label">${escapeHtml(name)}</div>
                  <div class="gg-opts" data-option-index="${idx}">
                    ${vals.map(v => `<button class="gg-opt" type="button" data-idx="${idx}" data-value="${escapeHtml(v)}" aria-pressed="${v === selected[idx] ? 'true' : 'false'}">${escapeHtml(v)}</button>`).join('')}
                  </div>
                </div>`;
              } else {
                return `<div class="gg-variant-row" data-idx="${idx}">
                  <label class="gg-variant-label" for="gg-select-${idx}">${escapeHtml(name)}</label>
                  <select id="gg-select-${idx}" class="gg-select" data-idx="${idx}">
                    ${vals.map(v => `<option value="${escapeHtml(v)}" ${v === selected[idx] ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
                  </select>
                </div>`;
              }
            }).join('')}
          </div>

          <div>
            <button class="add-to-cart gg-add" id="gg-add">ADD TO CART <span class="gg-add__arrow">→</span></button>
          </div>
          <div id="gg-add-msg" class="gg-msg" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    wireVariantUI(product, selected);
    openModal();
  }

  function findActiveOptionDom(index) {
    const btn = modalBody.querySelector(`.gg-opts[data-option-index="${index}"] .gg-opt[aria-pressed="true"]`);
    if (btn) return btn.dataset.value;
    const sel = modalBody.querySelector(`.gg-select[data-idx="${index}"]`);
    if (sel) return sel.value;
    return null;
  }

  function wireVariantUI(product, selected) {
    const priceEl = modalBody.querySelector('#gg-price');
    const addBtn = modalBody.querySelector('#gg-add');
    const msg = modalBody.querySelector('#gg-add-msg');

    function updatePriceUI() {
      const v = getVariantByOptions(product, selected);
      priceEl.textContent = formatMoney(v.price);
      addBtn.disabled = !v.available;
      addBtn.dataset.variantId = v.id;
    }
    updatePriceUI();

    // buttons
    modalBody.querySelectorAll('.gg-opt').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.dataset.idx, 10);
        selected[idx] = this.dataset.value;
        modalBody.querySelectorAll(`.gg-opt[data-idx="${idx}"]`).forEach(b => b.setAttribute('aria-pressed', 'false'));
        this.setAttribute('aria-pressed', 'true');
        updatePriceUI();
      });
    });

    // selects
    modalBody.querySelectorAll('.gg-select').forEach(sel => {
      sel.addEventListener('change', function () {
        const idx = parseInt(this.dataset.idx, 10);
        selected[idx] = this.value;
        updatePriceUI();
      });
    });

    // add to cart click
    addBtn.addEventListener('click', function () {
      const variantId = Number(addBtn.dataset.variantId);
      if (!variantId) return;

      addBtn.disabled = true;
      msg.textContent = 'Adding…';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: 1 })
      })
      .then(r => {
        if (!r.ok) throw new Error('Add failed');
        return r.json();
      })
      .then(() => {
        msg.textContent = 'Added to cart!';

        // Re-evaluate selected options from DOM (defensive)
        const colorIdx = (product.options || []).indexOf('Color');
        const sizeIdx = (product.options || []).indexOf('Size');
        const selectedColor = colorIdx >= 0 ? (selected[colorIdx] || findActiveOptionDom(colorIdx)) : '';
        const selectedSize  = sizeIdx >= 0 ? (selected[sizeIdx]  || findActiveOptionDom(sizeIdx)) : '';

        if ((selectedColor || '').toString().toLowerCase() === 'black' && (selectedSize || '').toString().toLowerCase() === 'medium') {
          // add upsell product by fetching its product JSON
          fetch(`/products/${UPSELL_PRODUCT_HANDLE}.js`)
            .then(r => r.ok ? r.json() : Promise.reject('No upsell'))
            .then(up => {
              if (up && up.variants && up.variants[0]) {
                return fetch('/cart/add.js', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: up.variants[0].id, quantity: 1 })
                });
              }
            })
            .catch(err => {
              console.warn('Upsell failed', err);
            });
        }

        setTimeout(closeModal, 900);
      })
      .catch(err => {
        console.error(err);
        msg.textContent = 'Failed to add. Please try again.';
      })
      .finally(() => {
        addBtn.disabled = false;
      });
    });
  }
})();