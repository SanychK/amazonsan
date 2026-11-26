
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Товар не знайдено", { status: 404 });
  }

  const supabaseUrl =
    env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey =
    env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Налаштування бази даних відсутні", {
      status: 500
    });
  }

  const endpoint = new URL("/rest/v1/products", supabaseUrl);

  endpoint.searchParams.set(
    "select",
    "id,title,brand,model,category,description,specs,image_url,sku,status"
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
    return new Response("Не вдалося завантажити товар", {
      status: 502
    });
  }

  const products = await response.json();
  const product = products[0];

  if (!product) {
    return new Response("Товар не знайдено", { status: 404 });
  }

  const title = product.title || "Товар AMAZONSAN";
  const description = product.description ||
    `${title} — інформація про товар у каталозі AMAZONSAN.`;

  const image = product.image_url || "";
  const canonical =
    `https://amazonsan.pages.dev/product/${product.id}`;

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
    ...(product.sku ? { sku: product.sku } : {}),
    ...(image ? { image } : {})
  };

  const html = `<!doctype html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — AMAZONSAN</title>
<meta name="description" content="${escapeHtml(description.slice(0, 300))}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description.slice(0, 300))}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head>
<body>
<main>
<p><a href="/">AMAZONSAN — каталог товарів</a></p>
<h1>${escapeHtml(title)}</h1>
${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="max-width:400px;width:100%;height:auto">` : ""}
${product.brand ? `<p>Бренд: ${escapeHtml(product.brand)}</p>` : ""}
${product.model ? `<p>Модель: ${escapeHtml(product.model)}</p>` : ""}
${product.category ? `<p>Категорія: ${escapeHtml(product.category)}</p>` : ""}
<p>${escapeHtml(description)}</p>
${specs.length ? `<h2>Характеристики</h2><ul>${specs.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
<p><a href="/">Переглянути каталог AMAZONSAN</a></p>
</main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
