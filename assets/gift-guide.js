document.addEventListener("DOMContentLoaded", () => {
  // -------------------------------
  // MENU TOGGLE (Hamburger → X)
  // -------------------------------
  const menuBtn = document.querySelector(".gg-topbar__menu-btn");
  const navMenu = document.querySelector(".gg-topbar__nav");

  if (menuBtn && navMenu) {
    menuBtn.addEventListener("click", () => {
      navMenu.classList.toggle("open");
      menuBtn.classList.toggle("open");

      // Update button text/icon
      if (menuBtn.classList.contains("open")) {
        menuBtn.textContent = "✕";
      } else {
        menuBtn.textContent = "☰";
      }
    });
  }

  // -------------------------------
  // PRODUCT MODAL POPUP
  // -------------------------------
  const modal = document.querySelector(".product-modal");
  const modalContent = modal?.querySelector(".modal-content");
  const closeBtn = modal?.querySelector(".close-btn");

  // Open modal on product click
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const handle = card.dataset.handle;
      if (!handle || !modal) return;

      try {
        const res = await fetch(`/products/${handle}.js`);
        const product = await res.json();

        renderProductModal(product);
        modal.style.display = "block";
      } catch (err) {
        console.error("Error loading product:", err);
      }
    });
  });

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      modalContent.innerHTML = ""; // reset
    });
  }
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      modalContent.innerHTML = "";
    }
  });

  // -------------------------------
  // Render Product Info in Modal
  // -------------------------------
  function renderProductModal(product) {
    if (!modalContent) return;

    let variantOptionsHTML = "";
    product.options.forEach((opt, optIndex) => {
      variantOptionsHTML += `
        <div class="variant-option">
          <h4>${opt.name}</h4>
          <div class="variant-values">
            ${opt.values
              .map(
                (val) =>
                  `<button class="variant-btn" data-opt-index="${optIndex}" data-value="${val}">${val}</button>`
              )
              .join("")}
          </div>
        </div>`;
    });

    modalContent.innerHTML = `
      <h2>${product.title}</h2>
      <p>${product.description}</p>
      <p><strong>Price:</strong> ₹${(product.price / 100).toFixed(2)}</p>
      ${variantOptionsHTML}
      <button class="add-to-cart-btn">ADD TO CART</button>
      <p class="cart-status"></p>
    `;

    const selectedOptions = new Array(product.options.length).fill(null);

    // Variant select logic
    modalContent.querySelectorAll(".variant-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const optIndex = parseInt(btn.dataset.optIndex);
        selectedOptions[optIndex] = btn.dataset.value;

        // highlight selected
        btn.parentElement
          .querySelectorAll(".variant-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Add to cart logic
    modalContent.querySelector(".add-to-cart-btn").addEventListener("click", () => {
      const matchedVariant = product.variants.find((v) =>
        v.options.every((optVal, i) => selectedOptions[i] === optVal)
      );

      if (!matchedVariant) {
        modalContent.querySelector(".cart-status").textContent =
          "Please select all options!";
        return;
      }

      addToCart(matchedVariant.id, 1, product.title, matchedVariant.options);
    });
  }

  // -------------------------------
  // Add to Cart + Upsell
  // -------------------------------
  async function addToCart(variantId, qty, productTitle, selectedOptions) {
    try {
      await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantId, quantity: qty }),
      });

      // Update UI instantly
      await updateCartUI();

      document.querySelector(".cart-status").textContent = `${productTitle} added to cart!`;

      // UPSALE CHECK (Black + Medium)
      if (
        selectedOptions.includes("Black") &&
        selectedOptions.includes("Medium")
      ) {
        addSoftWinterJacket();
      }

      setTimeout(() => {
        document.querySelector(".product-modal").style.display = "none";
        document.querySelector(".modal-content").innerHTML = "";
      }, 1200);
    } catch (err) {
      console.error("Error adding to cart:", err);
    }
  }

  // -------------------------------
  // Soft Winter Jacket Upsell
  // -------------------------------
  async function addSoftWinterJacket() {
    try {
      const res = await fetch("/products/soft-winter-jacket.js");
      const jacket = await res.json();

      if (jacket.variants && jacket.variants.length > 0) {
        const firstVariantId = jacket.variants[0].id;

        await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: firstVariantId, quantity: 1 }),
        });

        await updateCartUI();

        console.log("Soft Winter Jacket auto-added!");
      }
    } catch (err) {
      console.error("Upsell failed:", err);
    }
  }

  // -------------------------------
  // Update Cart UI (Live without reload)
  // -------------------------------
  async function updateCartUI() {
    try {
      const res = await fetch("/cart.js");
      const cart = await res.json();

      // Example cart update: update cart count in header
      const cartCountEls = document.querySelectorAll(".cart-count");
      cartCountEls.forEach((el) => (el.textContent = cart.item_count));

      // If you have a mini-cart drawer, update it here
      const cartDrawer = document.querySelector(".mini-cart-items");
      if (cartDrawer) {
        cartDrawer.innerHTML = cart.items
          .map(
            (item) => `
              <div class="mini-cart-item">
                <span>${item.title}</span>
                <span>Qty: ${item.quantity}</span>
                <span>₹${(item.line_price / 100).toFixed(2)}</span>
              </div>`
          )
          .join("");
      }
    } catch (err) {
      console.error("Failed to update cart UI:", err);
    }
  }
});
