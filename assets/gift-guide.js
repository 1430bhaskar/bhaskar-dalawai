(() => {
  const POPUP_SELECTOR = '#gift-guide-popup';
  const GRID_SELECTOR = '.gift-guide-grid';
  const CARD_SELECTOR = '.gift-guide-card';

  let popup, selectedVariant, selected = {};

  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const norm = (v='') => v.toLowerCase().trim();
  const normalizeSize = (v='') => {
    const map = { 's':'small','m':'medium','l':'large','xl':'extra large' };
    const key = v.toLowerCase();
    return map[key] || key;
  };

  // ---------- Fetch product ----------
  async function fetchProductByHandle(handle) {
    const res = await fetch(`/products/${handle}.js`);
    if (!res.ok) throw new Error(`Product fetch failed: ${handle}`);
    return await res.json();
  }

  // ---------- Add variant to cart ----------
  async function addVariantToCart(variantId, qty=1) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: qty })
    }).then(r=>r.json());
  }

  // ---------- Popup control ----------
  function openPopup() { popup.classList.add('open'); }
  function closePopup() { popup.classList.remove('open'); }

  function resetState() {
    selected = {};
    selectedVariant = null;
    $('.gg-title', popup).textContent = '';
    $('.gg-price', popup).textContent = '';
    $('.gg-options', popup).innerHTML = '';
    $('[data-el="note"]', popup).textContent = '';
  }

  // ---------- Render product in popup ----------
  function renderFromProduct(product) {
    $('.gg-title', popup).textContent = product.title;
    $('.gg-price', popup).textContent = (product.price/100).toFixed(2);

    const optsEl = $('.gg-options', popup);
    optsEl.innerHTML = '';

    product.options.forEach((opt, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'gg-opt';

      // Color swatches → polished buttons
      if (opt.name.toLowerCase().includes('color')) {
        wrap.innerHTML = `<label>${opt.name}</label>`;
        opt.values.forEach(v=>{
          const b=document.createElement('button');
          b.className='gg-swatch';
          b.textContent=v;
          b.addEventListener('click',()=>{
            selected.color = norm(v);
            $$('.gg-swatch', wrap).forEach(el=>el.classList.remove('active'));
            b.classList.add('active');
            resolveVariant(product);
          });
          wrap.appendChild(b);
        });
      }

      // Size dropdown → clean select
      else if (opt.name.toLowerCase().includes('size')) {
        const label=document.createElement('label');
        label.textContent=opt.name;
        const sel = document.createElement('select');
        sel.className='gg-size-select';
        opt.values.forEach(v=>{
          const o=document.createElement('option');
          o.value=v;o.textContent=v;
          sel.appendChild(o);
        });
        sel.addEventListener('change', e=>{
          selected.size = normalizeSize(e.target.value);
          resolveVariant(product);
        });
        wrap.appendChild(label);
        wrap.appendChild(sel);
      }

      optsEl.appendChild(wrap);
    });

    resolveVariant(product);
  }

  // ---------- Resolve variant ----------
  function resolveVariant(product) {
    selectedVariant = product.variants.find(v=>{
      return v.options.every((val,i)=>{
        const name = product.options[i].name.toLowerCase();
        if (name.includes('size')) return normalizeSize(val)===selected.size;
        if (name.includes('color')||name.includes('colour')) return norm(val)===selected.color;
        return true;
      });
    });
    if (selectedVariant) {
      $('.gg-price', popup).textContent = (selectedVariant.price/100).toFixed(2);
    }
  }

  // ---------- Wire grid ----------
  function wireGrid() {
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
          let handle = card.getAttribute('data-product-handle');
          if (!handle) {
            const link = card.getAttribute('href') 
              || card.querySelector('a[href*="/products/"]')?.getAttribute('href');
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
  }

  // ---------- Add to cart ----------
  function wireATC() {
    $('.gg-atc', popup).addEventListener('click', async () => {
      if (!selectedVariant) return;
      try {
        const color = norm(selected.color||'');
        const size = normalizeSize(selected.size||'');

        await addVariantToCart(selectedVariant.id,1);
        console.log('Added main product:', selectedVariant.title);

        // Upsell rule: Black + Medium
        if (color==='black' && size==='medium') {
          console.log('Upsell: Black+Medium → Soft Winter Jacket');
          const bonus = await fetchProductByHandle('soft-winter-jacket');
          const bv = bonus.variants.find(v=>v.available) || bonus.variants[0];
          if (bv) {
            await addVariantToCart(bv.id,1);
            console.log('Bonus added:', bonus.title, bv.title);
          }
        }

        $('[data-el="note"]', popup).textContent = 'Added!';
        setTimeout(closePopup,1000);
      } catch(e) {
        $('[data-el="note"]', popup).textContent = 'Add failed';
        console.error(e);
      }
    });
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    popup = $(POPUP_SELECTOR);
    if (!popup) return;

    wireGrid();
    wireATC();
    $('.gg-close', popup)?.addEventListener('click', closePopup);
  });

})();
