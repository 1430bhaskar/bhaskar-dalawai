/* gift-guide.js — Fixed upsell + popup
 *
 * - Opens product popup from grid.
 * - Renders Color (buttons) + Size (dropdown).
 * - Resolves correct variant.
 * - Adds to cart via AJAX.
 * - Upsell: if Color=Black and Size=Medium (or "M"), auto-add soft-winter-jacket.
 */

(() => {
  const GRID_SELECTOR = '#gift-guide-grid';
  const CARD_SELECTOR = '.gg-card, [data-product-handle], [data-product-json]';
  const BONUS_PRODUCT_HANDLE_FALLBACK = 'soft-winter-jacket';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const norm = (s) => String(s || '').trim().toLowerCase();

  const normalizeSize = (s) => {
    const n = norm(s);
    if (['m','med','medium'].includes(n)) return 'medium';
    if (['s','small'].includes(n)) return 'small';
    if (['l','large'].includes(n)) return 'large';
    if (['xl','x-large','extra large'].includes(n)) return 'medium'; // adjust if needed
    if (['xs','x-small','extra small'].includes(n)) return 'xs';
    return n;
  };

  const colorMap = { black:'#000', white:'#fff', grey:'gray', gray:'gray', blue:'blue', red:'red' };
  const toCssColor = (v) => {
    const val = norm(v).split(/\s|-/)[0];
    return colorMap[val] || v;
  };

  const moneyFormat = (cents) => {
    const value = (cents/100).toFixed(2);
    return `$${value}`;
  };

  const getBonusHandle = () => {
    const grid = $(GRID_SELECTOR);
    return (grid && grid.getAttribute('data-bonus-handle')) || BONUS_PRODUCT_HANDLE_FALLBACK;
  };

  const fetchProductByHandle = async (handle) => {
    const res = await fetch(`/products/${handle}.js`);
    if (!res.ok) throw new Error(`fetch fail: ${handle}`);
    return await res.json();
  };

  const addVariantToCart = async (variantId, qty=1) => {
    const res = await fetch('/cart/add.js',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:variantId,quantity:qty})
    });
    if(!res.ok) throw new Error('ATC failed');
    return await res.json();
  };

  const injectPopupShell = () => {
    if($('#gg-overlay')) return;
    document.body.insertAdjacentHTML('beforeend',`
      <div id="gg-overlay" class="gg-overlay" hidden>
        <div class="gg-modal">
          <button class="gg-close" aria-label="Close">×</button>
          <div class="gg-content">
            <div class="gg-media"><img class="gg-image" alt=""/></div>
            <div class="gg-info">
              <h3 class="gg-title"></h3>
              <div class="gg-price" data-el="price"></div>
              <p class="gg-desc" data-el="desc"></p>
              <div class="gg-field" data-el="color-field" hidden>
                <label>Color</label><div class="gg-colors" data-el="colors"></div>
              </div>
              <div class="gg-field" data-el="size-field" hidden>
                <label>Size</label>
                <select class="gg-select" data-el="size-select"><option value="">Choose</option></select>
              </div>
              <button type="button" class="gg-atc" disabled>ADD TO CART →</button>
              <div class="gg-note" data-el="note"></div>
            </div>
          </div>
        </div>
      </div>`);
  };

  const openPopup = () => { $('#gg-overlay').hidden=false; };
  const closePopup = () => { $('#gg-overlay').hidden=true; };

  let currentProduct=null, selected={}, selectedVariant=null;

  const resetState = () => { currentProduct=null; selected={}; selectedVariant=null; };

  const mapOptions = (p)=>{ const m={}; p.options.forEach((n,i)=>{m[norm(n)]={i,values:[...new Set(p.variants.map(v=>v.options[i]))]};}); return m; };

  const renderProduct = (p) => {
    currentProduct=p;
    $('.gg-title').textContent=p.title;
    $('.gg-image').src=p.featured_image||p.images[0]||'';
    $('.gg-desc').textContent=(p.description||'').replace(/<[^>]+>/g,'');
    $('[data-el="price"]').textContent=moneyFormat(p.variants[0].price);

    const opts=mapOptions(p);

    // colors
    const cw=$('[data-el="colors"]'); cw.innerHTML='';
    if(opts.color||opts.colour){
      const o=opts.color||opts.colour;
      $('[data-el="color-field"]').hidden=false;
      o.values.forEach(v=>{
        const b=document.createElement('button'); b.type='button'; b.className='gg-color'; b.textContent=v; b.dataset.value=v; b.style.background=toCssColor(v);
        b.addEventListener('click',()=>{ $$('.gg-color').forEach(x=>x.classList.remove('is-active')); b.classList.add('is-active'); selected.color=v; resolveVariant();});
        cw.appendChild(b);
      });
      cw.querySelector('button')?.click();
    }

    // sizes
    const ss=$('[data-el="size-select"]'); ss.innerHTML='<option value="">Choose</option>';
    if(opts.size){
      $('[data-el="size-field"]').hidden=false;
      opts.size.values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; ss.appendChild(o);});
      ss.addEventListener('change',()=>{ selected.size=normalizeSize(ss.value); resolveVariant();});
    }

    resolveVariant();
    openPopup();
  };

  const resolveVariant=()=>{
    if(!currentProduct) return;
    const opts=currentProduct.options.map(norm);
    const want=opts.map(n=>selected[n]||null);
    selectedVariant=currentProduct.variants.find(v=>v.options.every((val,i)=>!want[i]||norm(val)===norm(want[i])));
    if(selectedVariant) $('[data-el="price"]').textContent=moneyFormat(selectedVariant.price);
    $('.gg-atc').disabled=!selectedVariant||!selectedVariant.available||opts.some(n=>!selected[n]);
  };

  const attachGlobalEvents=()=>{
    $('.gg-close').addEventListener('click',closePopup);
    $('#gg-overlay').addEventListener('click',(e)=>{if(e.target.id==='gg-overlay')closePopup();});
    $('.gg-atc').addEventListener('click',async()=>{
      if(!selectedVariant) return;
      const color=norm(selected.color||selected.colour||'');
      const size=normalizeSize(selected.size||'');
      try{
        await addVariantToCart(selectedVariant.id,1);
        if(color==='black'&&size==='medium'){
          const bonus=await fetchProductByHandle(getBonusHandle());
          const bv=bonus.variants.find(v=>v.available)||bonus.variants[0];
          if(bv) await addVariantToCart(bv.id,1);
        }
        $('[data-el="note"]').textContent='Added!';
        setTimeout(closePopup,1000);
      }catch(e){ $('[data-el="note"]').textContent='Add failed'; console.error(e);}
    });
  };

  const wireGrid=()=>{
    const grid=$(GRID_SELECTOR); if(!grid) return;
    grid.addEventListener('click',async(evt)=>{
      const card=evt.target.closest(CARD_SELECTOR)||evt.target.closest('a[href*="/products/"]'); if(!card) return;
      evt.preventDefault(); resetState();
      try{
        let p; const json=card.getAttribute('data-product-json');
        if(json){p=JSON.parse(json);}else{let h=card.getAttribute('data-product-handle'); if(!h){const l=card.getAttribute('href')||card.querySelector('a[href*="/products/"]')?.href; h=l?.match(/\/products\/([\w-]+)/)?.[1];} if(!h)return; p=await fetchProductByHandle(h);}
        renderProduct(p);
      }catch(e){console.error('Popup open failed',e);}
    });
  };

  document.addEventListener('DOMContentLoaded',()=>{ injectPopupShell(); attachGlobalEvents(); wireGrid(); });
})();
