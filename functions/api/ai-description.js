
export async function onRequestPost({ request, env }) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  try {
    if (!env.AI) {
      return json({ error: "AI не підключений у Cloudflare Pages." }, 500);
    }

    const supabaseUrl =
      env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey =
      env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Не налаштовані змінні Supabase." }, 500);
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");

    if (!token) {
      return json({ error: "Потрібно увійти в акаунт адміністратора." }, 401);
    }

    const authResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!authResponse.ok) {
      return json({ error: "Не вдалося підтвердити авторизацію." }, 401);
    }

    const user = await authResponse.json();

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!profileResponse.ok) {
      return json({ error: "Не вдалося перевірити права адміністратора." }, 403);
    }

    const profiles = await profileResponse.json();

    if (!profiles?.[0]?.is_admin) {
      return json({ error: "Доступ дозволений лише адміністратору." }, 403);
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const model = String(body.model || "").trim();
    const purpose = String(body.purpose || "").trim();
    const suppliedSpecs = String(body.specs || "").trim();

    if (!title) {
      return json({ error: "Вкажи назву товару." }, 400);
    }

    const categories = [
      "Електроніка",
      "Дім і кухня",
      "Одяг і взуття",
      "Краса та догляд",
      "Здоров’я",
      "Спорт і туризм",
      "Автотовари",
      "Дитячі товари",
      "Іграшки та хобі",
      "Інструменти",
      "Товари для тварин",
      "Офіс і канцелярія",
      "Продукти та напої",
      "Музика",
      "Сад і город",
      "Ювелірні вироби",
      "Багаж і подорожі",
      "Товари для бізнесу",
      "Інше",
    ];

    const prompt = `
Ти — професійний фахівець з пошуку, перевірки та підготовки товарів для українського інтернет-магазину AMAZONSAN.

ЗАВДАННЯ:
Знайди в інтернеті саме цей товар і підготуй повну структуровану картку українською мовою.

Назва товару: ${title}
Модель від користувача: ${model || "Не вказана"}
Призначення: ${purpose || "Не вказано"}
Додаткові дані від користувача: ${suppliedSpecs || "Не надано"}

ОБОВ'ЯЗКОВІ ПРАВИЛА ПОШУКУ:
1. Шукай точну модель товару, а не просто схожий товар.
2. Насамперед використовуй офіційний сайт виробника.
3. Додатково перевіряй Amazon та інші надійні джерела.
4. Збирай лише характеристики, які вдалося підтвердити.
5. Не вигадуй потужність, розміри, матеріали, комплектацію, сумісність, функції або інші характеристики.
6. Якщо інформацію не вдалося перевірити, не додавай її як факт.
7. Якщо модель неоднозначна, чесно зазнач це в описі.
8. Не плутай різні покоління та модифікації товару.

КАТЕГОРІЇ AMAZONSAN:
${categories.join(", ")}

ВИМОГИ ДО РЕЗУЛЬТАТУ:
- title: зрозуміла, приваблива українська назва товару.
- brand: підтверджений виробник або бренд. Якщо невідомий — порожній рядок.
- model: точна підтверджена модель. Якщо невідома — порожній рядок.
- category: одна найбільш відповідна категорія зі списку вище.
- subcategory: коротка доречна підкатегорія українською.
- description: повний, привабливий і професійний опис українською мовою. Додай вступ, призначення, переваги, особливості та підтверджені характеристики. Використовуй зрозумілі абзаци й символи •. Не використовуй Markdown-зірочки.
- specs: масив підтверджених характеристик. Першими додай бренд і модель у форматі "Бренд: ..." та "Модель: ...", якщо вони відомі.
- key_features: масив найважливіших підтверджених переваг.
- package_contents: масив елементів комплектації лише тоді, коли комплектацію підтверджено.
- keywords: масив доречних пошукових слів українською.
- image_search_query: точний пошуковий запит для пошуку фотографій саме цієї моделі. Не вигадуй URL фотографій.

Усі текстові поля мають бути українською, крім офіційних назв брендів і моделей.
Якщо характеристика не підтверджена — не вигадуй її.
Не додавай ціни, рейтинги, відгуки або наявність товару, якщо вони не підтверджені.
`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        brand: { type: "string" },
        model: { type: "string" },
        category: { type: "string" },
        subcategory: { type: "string" },
        description: { type: "string" },
        specs: {
          type: "array",
          items: { type: "string" },
        },
        key_features: {
          type: "array",
          items: { type: "string" },
        },
        package_contents: {
          type: "array",
          items: { type: "string" },
        },
        keywords: {
          type: "array",
          items: { type: "string" },
        },
        image_search_query: { type: "string" },
      },
      required: [
        "title",
        "brand",
        "model",
        "category",
        "subcategory",
        "description",
        "specs",
        "key_features",
        "package_contents",
        "keywords",
        "image_search_query",
      ],
      additionalProperties: false,
    };

    const aiResponse = await env.AI.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages: [
          {
            role: "system",
            content: "Виконуй пошук і перевірку фактів. Поверни тільки коректний JSON відповідно до заданої схеми.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "amazonsan_product",
            strict: true,
            schema,
          },
        },
        web_search_options: {
          search_context_size: "medium",
        },
        max_completion_tokens: 3500,
        temperature: 0.2,
        reasoning_effort: "low",
      }
    );

    const message = aiResponse?.choices?.[0]?.message;

let content =
  message?.parsed ??
  message?.content ??
  aiResponse?.parsed ??
  aiResponse?.response ??
  aiResponse?.result?.response;

    if (Array.isArray(content)) {
      content = content
        .map((part) => part.text || "")
        .join("");
    }

    if (content && typeof content === "object") {
      content = JSON.stringify(content);
    }

    if (typeof content !== "string" || !content.trim()) {
      return json({ error: "AI не повернув опис товару. Спробуй ще раз." }, 502);
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let product;

    try {
      product = JSON.parse(cleaned);
    } catch {
      return json({
        error: "AI повернув некоректні дані. Спробуй ще раз.",
      }, 502);
    }

    const annotations =
      aiResponse?.choices?.[0]?.message?.annotations || [];

    const sources = annotations
      .map((item) => {
        const url =
          item.url ||
          item.webpage?.url ||
          item.source?.url ||
          item.annotation?.url;

        const title =
          item.title ||
          item.webpage?.title ||
          item.source?.title ||
          "";

        return url ? { title, url } : null;
      })
      .filter(Boolean);

    return json({
      ...product,
      sources,
    });
  } catch (error) {
    return json(
      {
        error: error?.message || "Помилка AI-помічника. Спробуй ще раз.",
      },
      500
    );
  }
}
