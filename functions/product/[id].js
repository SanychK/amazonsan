
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const escapeJson = value =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export async function onRequestGet({ request, params, env }) {
  const id = String(params.id || "");

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Товар не знайдено", { status: 404 });
  }

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Не налаштовано доступ до бази товарів", {
      status: 500
    });
  }

  const endpoint = new URL("/rest/v1/products", supabaseUrl);

  endpoint.searchParams.set(
    "select",
    "id,title,brand,model,category,subcategory,description,specs,image_url,sku,status,price_uah,original_price_uah,stock_status"
  );
  endpoint.searchParams.set("id", `eq.${id}`);
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    return new Response("Помилка завантаження товару", {
      status: 502
    });
  }

  const products = await response.json();
  const product = products[0];

  if (!product) {
    return new Response("Товар не знайдено", { status: 404 });
  }

  const title = product.title || "Товар AMAZONSAN";
  const description = String(
    product.description ||
    `${title} — інформація про товар у каталозі AMAZONSAN.`
  ).slice(0, 300);

  const image = product.image_url || "";
  const canonical = `https://amazonsan.pages.dev/product/${product.id}`;

  const specs = Array.isArray(product.specs)
    ? product.specs
    : [];

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    url: canonical,
    ...(product.brand ? {
      brand: {
        "@type": "Brand",
        name: product.brand
      }
    } : {}),
    ...(product.model ? { model: product.model } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(image ? { image: [image] } : {}),
    ...(product.price_uah != null && Number(product.price_uah) > 0 ? {
      offers: {
        "@type": "Offer",
        url: canonical,
        priceCurrency: "UAH",
        price: Number(product.price_uah).toString(),
        ...(product.stock_status ? {
          availability: product.stock_status === "out_of_stock"
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock"
        } : {})
      }
    } : {})
  };

  const fallback = `
    <main>
      <p><a href="/">AMAZONSAN — каталог товарів</a></p>
      <h1>${escapeHtml(title)}</h1>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="max-width:420px;width:100%;height:auto">` : ""}
      ${product.brand ? `<p>Бренд: ${escapeHtml(product.brand)}</p>` : ""}
      ${product.model ? `<p>Модель: ${escapeHtml(product.model)}</p>` : ""}
      ${product.category ? `<p>Категорія: ${escapeHtml(product.category)}</p>` : ""}
      <p>${escapeHtml(description)}</p>
      ${specs.length ? `<h2>Характеристики</h2><ul>${specs.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
      ${product.price_uah != null ? `<p>Ціна: ${escapeHtml(product.price_uah)} грн</p>` : ""}
      <p><a href="/">Переглянути каталог AMAZONSAN</a></p>
    </main>
  `;

  const appResponse = await env.ASSETS.fetch(
    new URL("/", request.url)
  );

  if (!appResponse.ok) {
    return new Response("Не вдалося завантажити основний сайт", {
      status: 502
    });
  }

  let html = await appResponse.text();

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)} — AMAZONSAN</title>`
  );

  html = html.replace(
    /<meta\s+name="description"[\s\S]*?>/i,
    `<meta name="description" content="${escapeHtml(description)}">`
  );

  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonical}">`
  );

  const replaceMeta = (property, content) => {
    const tag = `<meta property="${property}" content="${escapeHtml(content)}">`;
    const pattern = new RegExp(
      `<meta\\\\s+property=["']${property}["'][^>]*>`,
      "i"
    );

    if (pattern.test(html)) {
      html = html.replace(pattern, tag);
    } else {
      html = html.replace("</head>", `${tag}</head>`);
    }
  };

  replaceMeta("og:type", "product");
  replaceMeta("og:title", `${title} — AMAZONSAN`);
  replaceMeta("og:description", description);
  replaceMeta("og:url", canonical);

  if (image) {
    replaceMeta("og:image", image);
  }

  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${fallback}</div>`
  );

  html = html.replace(
    "</head>",
    `<script type="application/ld+json">${escapeJson(schema)}</script></head>`
  );

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
