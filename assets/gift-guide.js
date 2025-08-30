document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".gg-topbar__menu-btn");
  const navMenu = document.querySelector(".gg-topbar__nav");

  // ---------------- MENU TOGGLE ----------------
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("open");
      document.body.classList.toggle("menu-open", isOpen);
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // ---------------- POPUP ----------------
  const popup = document.querySelector(".gg-popup");
  const popupContent = document.querySelector(".gg-popup__content");
  const closeBtn = document.querySelector(".gg-popup__close");

  document.querySelectorAll(".gg-product-card__plus").forEach((plusBtn) => {
    plusBtn.addEventListener("click", async () => {
      const handle = plusBtn.dataset.handle;
      await loadProductPopup(handle);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      popup.classList.remove("open");
    });
  }

  async function loadProductPopup(handle) {
    try {
      const res = await fetch(`/products/${handle}.js`);
      if (!res.ok) throw new Error("Could not load product");
      const product = await res.json();

      popupContent.innerHTML = `
        <h2>${product.title}</h2>
        <p>${(product.price / 100).toFixed(2)} ${Shopify.currency.active}</p>
        <p>${product.description || ""}</p>
        ${renderVariants(product)}
        <button class="gg-add-to-cart" data-id="${product.variants[0].id}">
          ADD TO CART
        </button>
      `;

      popup.classList.add("open");

      const addBtn = popupContent.querySelector(".gg-add-to-cart");
      addBtn.addEventListener("click", async () => {
        const variantSelect = popupContent.querySelector("#variant-select");
        const variantId = variantSelect ? variantSelect.value : addBtn.dataset.id;
        await addToCart(variantId, 1);
      });
    } catch (err) {
      console.error(err);
      popupContent.innerHTML = `<p>Could not load product. Try again.</p>`;
      popup.classList.add("open");
    }
  }

  function renderVariants(product) {
    if (!product.variants || product.variants.length <= 1) return "";
    return `
      <label for="variant-select">Choose variant:</label>
      <select id="variant-select">
        ${product.variants
          .map(
            (v) =>
              `<option value="${v.id}">${v.title} - ${(v.price / 100).toFixed(2)} ${
                Shopify.currency.active
              }</option>`
          )
          .join("")}
      </select>
    `;
  }

  // ---------------- CART ----------------
  async function addToCart(variantId, quantity = 1) {
    try {
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantId, quantity }),
      });

      // Refresh cart instantly
      await refreshCartDrawer();

      // Check upsell condition
      const cartRes = await fetch(`/cart.js`);
      const cartData = await cartRes.json();
      const addedItem = cartData.items.find((i) => i.variant_id == variantId);

      if (addedItem) {
        const color = addedItem.options_with_values.find((o) => o.name.toLowerCase() === "color")?.value;
        const size = addedItem.options_with_values.find((o) => o.name.toLowerCase() === "size")?.value;

        if (
          color &&
          size &&
          color.trim().toLowerCase() === "black" &&
          size.trim().toLowerCase() === "medium"
        ) {
          await addUpsellIfMissing("soft-winter-jacket");
        }
      }
    } catch (err) {
      console.error("Cart error:", err);
    }
  }

  async function addUpsellIfMissing(handle) {
    try {
      const res = await fetch(`/products/${handle}.js`);
      if (!res.ok) return;
      const product = await res.json();
      const variantId = product.variants[0].id;

      const cartRes = await fetch(`/cart.js`);
      const cart = await cartRes.json();
      const alreadyInCart = cart.items.some((i) => i.product_id === product.id);

      if (!alreadyInCart) {
        await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: variantId, quantity: 1 }),
        });
        await refreshCartDrawer();
      }
    } catch (err) {
      console.error("Upsell error:", err);
    }
  }

  async function refreshCartDrawer() {
    try {
      const res = await fetch("/cart.js");
      const cart = await res.json();
      const cartCountEls = document.querySelectorAll(".cart-count");
      cartCountEls.forEach((el) => (el.textContent = cart.item_count));

      // If you have a cart drawer, re-render it here with cart.items
    } catch (err) {
      console.error("Cart refresh error:", err);
    }
  }
});
