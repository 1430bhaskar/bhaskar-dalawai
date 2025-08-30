document.addEventListener("DOMContentLoaded", () => {
  console.log("gift-guide.js loaded");

  // ---------------- MENU TOGGLE (aria only, CSS handles visuals) ----------------
  const menuBtn = document.querySelector(".gg-topbar__menu-btn");
  const navPanel = document.getElementById("gg-topbar-panel");

  if (menuBtn && navPanel) {
    menuBtn.addEventListener("click", () => {
      const expanded = menuBtn.getAttribute("aria-expanded") === "true";
      menuBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
      navPanel.hidden = expanded;
    });
  }

  // ---------------- MODAL ----------------
  const modal = document.getElementById("gg-modal");
  const modalBody = modal?.querySelector(".gg-modal__body");
  const modalClose = modal?.querySelector(".gg-modal__close");

  document.querySelectorAll(".gg-card__plus").forEach((plusBtn) => {
    plusBtn.addEventListener("click", async (e) => {
      const card = e.target.closest(".gg-card");
      const handle = card.dataset.handle;
      await loadProductPopup(handle);
    });
  });

  if (modalClose) {
    modalClose.addEventListener("click", () => {
      modal.classList.add("gg-is-hidden");
      modal.setAttribute("aria-hidden", "true");
    });
  }

  async function loadProductPopup(handle) {
    try {
      const res = await fetch(`/products/${handle}.js`);
      if (!res.ok) throw new Error("Could not load product");
      const product = await res.json();

      modalBody.innerHTML = `
        <h2>${product.title}</h2>
        <p>${(product.price / 100).toFixed(2)} ${Shopify.currency.active}</p>
        <p>${product.description || ""}</p>
        ${renderVariants(product)}
        <button class="gg-add-to-cart" data-id="${product.variants[0].id}">
          ADD TO CART
        </button>
      `;

      modal.classList.remove("gg-is-hidden");
      modal.setAttribute("aria-hidden", "false");

      const addBtn = modalBody.querySelector(".gg-add-to-cart");
      addBtn.addEventListener("click", async () => {
        const variantSelect = modalBody.querySelector("#variant-select");
        const variantId = variantSelect ? variantSelect.value : addBtn.dataset.id;
        await addToCart(variantId, 1);
      });
    } catch (err) {
      console.error(err);
      modalBody.innerHTML = `<p>Could not load product. Try again.</p>`;
      modal.classList.remove("gg-is-hidden");
      modal.setAttribute("aria-hidden", "false");
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
        const color = addedItem.options_with_values.find(
          (o) => o.name.toLowerCase() === "color"
        )?.value;
        const size = addedItem.options_with_values.find(
          (o) => o.name.toLowerCase() === "size"
        )?.value;

        if (
          color &&
          size &&
          color.trim().toLowerCase() === "black" &&
          size.trim().toLowerCase() === "medium"
        ) {
          const upsellHandle =
            document
              .getElementById("gift-guide-grid-anchor")
              .closest("section")
              ?.dataset.upsellHandle || "soft-winter-jacket";
          await addUpsellIfMissing(upsellHandle);
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
      // 🔔 If you have a cart drawer, re-render it here
    } catch (err) {
      console.error("Cart refresh error:", err);
    }
  }
});
