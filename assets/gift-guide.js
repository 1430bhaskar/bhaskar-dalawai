(() => {
  // --- Constants and State ---
  const POPUP_SELECTOR = '#gg-modal'; // Corrected: Match the ID in your Liquid file.
  const GRID_SELECTOR = '.gg-grid';
  const CARD_SELECTOR = '.gg-card';
  const GRID_SECTION_SELECTOR = '.gift-guide-grid-section';

  let popup, selectedVariant, upsellProductHandle;
  let selected = {}; // Holds current {color, size} selection

  // --- Utility Functions ---
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const norm = (v = '') => v.toLowerCase().trim();
  const normalizeSize = (v = '') => {
    const map = { 's': 'small', 'm': 'medium', 'l': 'large', 'xl': 'extra large' };
    const key = v.toLowerCase();
    return map[key] || key;
  };

  // --- API Functions ---
  async function fetchProductByHandle(handle) {
    const res = await fetch(`/products/${handle}.js`);
    if (!res.ok) throw new Error(`Product fetch failed: ${handle}`);
    return await res.json();
  }

  async function addVariantToCart(variantId, qty = 1) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: qty })
    }).then(r => r.json());
  }

  // --- Popup Control ---
  function openPopup() {
    popup.classList.remove('gg-is-hidden');
    document.body.classList.add('gg-no-scroll'); // Prevents background scroll
  }

  function closePopup() {
    popup.classList.add('gg-is-hidden');
    document.body.classList.remove('gg-no-scroll'); // Re-enables scroll
  }

  function resetPopup() {
    selected = {};
    selectedVariant = null;
    const body = $('.gg-modal__body', popup);
    if (body) body.innerHTML = ''; // Clear previous content
  }

  // --- Core Logic: Variant Resolution ---
  function resolveVariant(product, elements) {
    // Find the variant that matches all selected options
    selectedVariant = product.variants.find(v => {
      return v.options.every((val, i) => {
        const optName = product.options[i].name.toLowerCase();
        if (optName.includes('color')) return norm(val) === selected.color;
        if (optName.includes('size')) return normalizeSize(val) === selected.size;
        return true; // For options we don't handle, like 'Style'
      });
    });

    // Update UI
    if (selectedVariant) {
      elements.price.textContent = `\$${(selectedVariant.price / 100).toFixed(2)}`;
      elements.atc.disabled = !selectedVariant.available;
      elements.atc.textContent = selectedVariant.available ? 'Add to Cart' : 'Sold Out';
    } else {
      elements.atc.disabled = true;
      elements.atc.textContent = 'Unavailable';
    }
    
    // Check for upsell after variant is resolved
    checkUpsell(elements.note);
  }

  // --- Core Logic: Upsell ---
  function checkUpsell(noteElement) {
    const isUpsell = norm(selected.color) === 'black' && normalizeSize(selected.size) === 'medium';
    if (isUpsell && upsellProductHandle) {
      noteElement.textContent = 'You get a free Soft Winter Jacket!';
    } else {
      noteElement.textContent = '';
    }
  }

  async function handleAddToCart() {
    if (!selectedVariant) return;
    
    const noteEl = $('[data-el="note"]', popup);
    try {
      await addVariantToCart(selectedVariant.id, 1);
      
      const isUpsell = norm(selected.color) === 'black' && normalizeSize(selected.size) === 'medium';
      
      if (isUpsell && upsellProductHandle) {
        const bonus = await fetchProductByHandle(upsellProductHandle);
        const bonusVariant = bonus.variants.find(v => v.available) || bonus.variants[0];
        if (bonusVariant) {
          await addVariantToCart(bonusVariant.id, 1);
        }
      }

      noteEl.textContent = 'Added to your cart! Updating ...';
      noteEl.style.color = 'green';
      
      // ⭐️ Reload the page after a short delay
      setTimeout(() => {
          window.location.reload();
      }, 1000);

    } catch (e) {
      noteEl.textContent = 'There was an error.';
      noteEl.style.color = 'red';
      console.error(e);
    }
  }

  // --- UI Rendering ---
function renderProductInPopup(product) {
  const body = $('.gg-modal__body', popup);
  if (!body) return;

  // 1. Create the main layout for the popup content
  const content = document.createElement('div');
  content.className = 'modal-product';
  // UPDATED: Single-column layout with image at the top
content.innerHTML = `
  <div class="modal-product__top">
    <img src="${product.featured_image}" alt="${product.title}" class="product-image">
    <div class="modal-product__info">
      <h3 class="gg-p-title">${product.title}</h3>
      <p class="gg-p-price" data-el="price"></p>
    </div>
  </div>
  <div class="gg-variants" data-el="options"></div>
  <button class="gg-add" data-el="atc">
  ADD TO CART
  <svg class="gg-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M2 12h14M13 5l7 7-7 7" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="1.6" 
          stroke-linecap="round" 
          stroke-linejoin="round">
    </path>
  </svg>
</button>
  <p class="gg-msg" data-el="note"></p>
`;

  body.appendChild(content);

  // 2. Cache the elements we need to update
  const elements = {
    price: $('[data-el="price"]', body),
    options: $('[data-el="options"]', body),
    atc: $('[data-el="atc"]', body),
    note: $('[data-el="note"]', body),
  };

  // 3. Set default selections
  selected.color = norm(product.options.find(o => o.name.toLowerCase().includes('color'))?.values[0]);
  selected.size = normalizeSize(product.options.find(o => o.name.toLowerCase().includes('size'))?.values[0]);

  // 4. Create and append option selectors
  // NEW: Reordered to show Size first, then Color
  const orderedOptions = [...product.options].sort((a, b) => {
    if (a.name.toLowerCase().includes('size')) return -1;
    if (b.name.toLowerCase().includes('size')) return 1;
    return 0;
  });
  
  orderedOptions.forEach((opt) => {
    const optName = opt.name.toLowerCase();
    const wrap = document.createElement('div');
    wrap.className = 'gg-variant-row';
    const label = document.createElement('label');
    label.className = 'gg-variant-label';
    label.textContent = opt.name;
    wrap.appendChild(label);

    if (optName.includes('color')) {
      const optsContainer = document.createElement('div');
      optsContainer.className = 'gg-opts';
      opt.values.forEach(v => {
        const b = document.createElement('button');
        b.className = 'gg-swatch';
        b.textContent = v;
        
        // Set initial active swatch
        if (norm(v) === selected.color) {
            b.classList.add('active');
            b.style.borderLeftColor = norm(v); // Set initial color
        }

        // UPDATED: Event listener with dynamic color logic
        b.addEventListener('click', () => {
          selected.color = norm(v);
          $$('.gg-swatch', optsContainer).forEach(el => {
            el.classList.remove('active');
            el.style.borderLeftColor = 'transparent'; // Reset all
          });
          b.classList.add('active');
          b.style.borderLeftColor = norm(v); // Set specific color (e.g., 'blue', 'black')
          resolveVariant(product, elements);
        });
        optsContainer.appendChild(b);
      });
      wrap.appendChild(optsContainer);

    } else if (optName.includes('size')) {
      const selectWrap = document.createElement('div');
      selectWrap.className = 'gg-select-wrap';
      
      const sel = document.createElement('select');
      sel.className = 'gg-select';
      // Add a placeholder option
      const placeholder = document.createElement('option');
      placeholder.textContent = "Choose your size";
      placeholder.value = "";
      placeholder.disabled = true;
      if (!selected.size) placeholder.selected = true;
      sel.appendChild(placeholder);
      
      opt.values.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        if (normalizeSize(v) === selected.size) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', e => {
        selected.size = normalizeSize(e.target.value);
        resolveVariant(product, elements);
      });
       
      // Clear wrap first
      selectWrap.innerHTML = '';
      selectWrap.appendChild(sel);

      // Add caret span with SVG
      const caret = document.createElement('span');
      caret.className = 'gg-caret';
      caret.innerHTML = `
        <svg class="arrow-icon" width="30" height="100%" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 4L6 7L9 4" stroke="black" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`; // down-facing
      selectWrap.appendChild(caret);

      const arrowDown = `
        <svg class="arrow-icon" width="30" height="100%" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 4L6 7L9 4" stroke="black" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

      const arrowUp = `
        <svg class="arrow-icon" width="30" height="100%" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 8L6 5L9 8" stroke="black" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

      // Toggle caret on focus/blur
      sel.addEventListener('focus', () => caret.innerHTML = arrowUp);
      sel.addEventListener('blur', () => caret.innerHTML = arrowDown);

      wrap.appendChild(selectWrap);
    }
    elements.options.appendChild(wrap);
  });

  // 5. Attach ATC listener and run initial variant resolution
  elements.atc.addEventListener('click', handleAddToCart);
  resolveVariant(product, elements);
}

  // --- Initialization ---
  async function onGridClick(evt) {
    const card = evt.target.closest(CARD_SELECTOR);
    if (!card) return;

    evt.preventDefault();
    resetPopup();

    try {
      const handle = card.dataset.handle; // Corrected: Use data-handle
      if (!handle) return;
      const product = await fetchProductByHandle(handle);
      renderProductInPopup(product);
      openPopup();
    } catch (err) {
      console.error("Popup open failed:", err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    popup = $(POPUP_SELECTOR);
    const grid = $(GRID_SELECTOR);
    const gridSection = $(GRID_SECTION_SELECTOR);

    if (!popup || !grid || !gridSection) {
      console.error("Gift Guide elements not found.");
      return;
    }

    // Get the upsell handle from the section's data attribute
    upsellProductHandle = gridSection.dataset.upsellHandle;

    grid.addEventListener('click', onGridClick);
    $('.gg-modal__close', popup)?.addEventListener('click', closePopup);
  });

})();