---
# Gift Guide (Shopify)

This repository contains the code for a custom Shopify section designed to create an interactive "Gift Guide" on an e-commerce store. The section features a responsive top banner, a dynamic product grid, and a quick-add modal for a seamless shopping experience.

---

### Features

* **Responsive Top Bar**: A sticky header with a logo, a promotional message, and a call-to-action (CTA) button. It transforms into a mobile-friendly hamburger menu that reveals a slide-down panel.
* **Dynamic Hero Banner**: A customizable, full-width hero image with an overlay for a title, subheading, and a main CTA.
* **Interactive Product Grid**: Displays a selection of products as image-only cards. Clicking a card opens a modal for quick-add functionality.
* **Quick-Add Modal**: A modal that fetches product data via JavaScript to display options (colors, sizes) and allows customers to add items to their cart without leaving the page.
* **Upsell Logic**: Includes a feature to automatically add a bonus product to the cart when a specific variant (e.g., "Black" and "Medium") is selected.
* **Clean & Maintainable Code**: The CSS is cleaned up and consolidated to remove redundancy. The JavaScript is modular, separating UI logic from data fetching.

---

### Installation

To add this functionality to your Shopify theme, follow these steps:

1.  **Download the files**: Copy the contents of the `gift-guide-banner.liquid`, `gift-guide-product-grid.liquid`, and `gift-guide.js` files.
2.  **Add to your theme**:
    * Place the code for `gift-guide-banner.liquid` and `gift-guide-product-grid.liquid` into two separate new files within your theme's **`sections/`** directory.
    * Place the code for the `gift-guide.js` file into a new file within your theme's **`assets/`** directory.
    * Place the provided cleaned-up CSS into your theme's main stylesheet (e.g., `theme.css` or `base.css`).

---

### Usage

1.  From your Shopify Admin, navigate to **Online Store** > **Themes** and click **Customize** on your current theme.
2.  Click **Add section** and select **Gift Guide — Banner**.
3.  Customize the banner content (logo, messages, links, and hero image) using the settings in the right-hand sidebar.
4.  Click **Add section** again and select **Gift Guide Product Grid**.
5.  In the grid section settings, select up to six products to display.
6.  Save your changes and preview the new Gift Guide section on your site.

---

### File Breakdown

* `gift-guide-banner.liquid`: The Liquid template for the top sticky banner and the main hero section. It includes schema settings for easy customization in the Shopify Theme Editor.
* `gift-guide-product-grid.liquid`: The Liquid template for the product grid and the quick-add modal. It includes schema settings for selecting which products to display and for the upsell product. It also defers the loading of the `gift-guide.js` file.
* `gift-guide.js`: The core JavaScript file that handles the interactive behavior. It manages the product modal, fetches product data, resolves variants based on user selections, and implements the upsell logic.
* `gift-guide.css`: The cleaned-up CSS file that contains all the styling for the sections, buttons, cards, and the modal. It's designed to be easily integrated into any Shopify theme's existing stylesheet.
