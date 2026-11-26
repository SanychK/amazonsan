
const escapeXml = value =>
  String(value).replace(/[<>&'"]/g, char => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[char]);

export async function onRequestGet({ env }) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Не налаштовано доступ до бази товарів", {
      status: 500
    });
  }

  const urls = ["https://amazonsan.pages.dev/"];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const endpoint = new URL("/rest/v1/products", supabaseUrl);
    endpoint.searchParams.set("select", "id");
    endpoint.searchParams.set("status", "eq.published");
    endpoint.searchParams.set("order", "id.asc");
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      return new Response("Не вдалося отримати список товарів", {
        status: 502
      });
    }

    const products = await response.json();

    for (const product of products) {
      if (product.id) {
        urls.push(
          `https://amazonsan.pages.dev/product/${encodeURIComponent(product.id)}`
        );
      }
    }

    if (products.length < pageSize) break;
    offset += pageSize;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
