
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

ГОЛОВНЕ ЗАВДАННЯ:
Знайди в інтернеті саме зазначений товар, перевір його характеристики за надійними джерелами та підготуй точну, повну й привабливу картку українською мовою.

ВХІДНІ ДАНІ:
Назва товару: ${title}
Модель від користувача: ${model || "Не вказана"}
Призначення: ${purpose || "Не вказано"}
Додаткові дані: ${suppliedSpecs || "Не надано"}

ОБОВ'ЯЗКОВИЙ ПОШУК І ПЕРЕВІРКА:
1. Знайди саме зазначену модель, а не схожий товар.
2. Спочатку перевір офіційний сайт виробника.
3. Додатково використовуй Amazon та інші надійні джерела.
4. Перевіряй відповідність кожної характеристики конкретній моделі.
5. Не плутай покоління, модифікації, комплектації та типи товарів.
6. Не вигадуй характеристики, матеріали, функції, сумісність або комплектацію.
7. Якщо джерела суперечать одне одному, віддавай перевагу офіційному виробнику.
8. Якщо факт не вдалося підтвердити — пропусти його.
9. Не використовуй рекламні твердження на кшталт «найкращий на ринку» без надійного підтвердження.
10. Не видавай припущення за перевірені факти.

КАТЕГОРІЇ AMAZONSAN:
${categories.join(", ")}

ПРАВИЛА ФОРМУВАННЯ ПОЛІВ:

1. title:
Зрозуміла та приваблива українська назва товару. Не повторюй назву кілька разів.

2. brand:
Тільки підтверджений бренд. Не додавай його повторно в це поле.

3. model:
Тільки точна підтверджена модель. Не додавай бренд замість моделі.

4. category:
Одна найбільш відповідна категорія зі списку AMAZONSAN.

5. subcategory:
Точна та доречна підкатегорія українською мовою.

6. description:
Створи професійний, інформативний та привабливий опис українською мовою.
Структура:
• Короткий вступ про товар.
• Для чого призначений товар.
• Основні можливості та особливості.
• Переваги для покупця.
• Важливі підтверджені характеристики.

Не дублюй один і той самий текст.
Не повторюй бренд і модель без потреби.
Не копіюй повністю список характеристик у текст опису.
Не додавай непідтверджених тверджень.
Використовуй зрозумілі абзаци та символи •. Не використовуй Markdown-зірочки.

7. specs:
Масив технічних характеристик у форматі "Назва характеристики: значення".
ВАЖЛИВО:
• НЕ додавай сюди бренд.
• НЕ додавай сюди модель.
• НЕ повторюй назву товару.
• Кожну характеристику вказуй тільки один раз.
• Визначай правильний тип товару за офіційними даними.
• Не додавай характеристики, які не вдалося перевірити.
• Не включай переваги, рекламні фрази та комплектацію до технічних характеристик.

8. key_features:
Масив із 3–7 найважливіших підтверджених переваг.
Кожна перевага має бути конкретною та змістовною.
Не повторюй одну перевагу різними словами.
Не вигадуй переваги.

9. package_contents:
Масив комплектуючих, які дійсно входять до комплекту саме цієї моделі.
Перевіряй комплектацію за виробником.
Не додавай аксесуари, які можна придбати окремо.
Якщо комплектація невідома — поверни порожній масив.

10. keywords:
Масив пошукових слів українською мовою.
Додай бренд, модель, тип товару, призначення та важливі пошукові фрази.
Не повторюй однакові слова без потреби.

11. image_search_query:
Точний пошуковий запит для пошуку фотографій саме цієї моделі.
Не вигадуй URL фотографій.

КРИТИЧНО ВАЖЛИВО — УСУНЕННЯ ДУБЛЮВАННЯ:
• Бренд повертається тільки в полі brand.
• Модель повертається тільки в полі model.
• Бренд і модель не повинні повторюватися в specs.
• Тип товару має бути правильним і зазначатися лише один раз у характеристиках.
• Не повторюй однакові характеристики.
• Не дублюй переваги.
• Не додавай вигадану комплектацію.
• Не повторюй однакові речення в описі.
• Кожне поле повинно містити тільки інформацію, призначену для нього.

УСІ ТЕКСТОВІ ПОЛЯ ПИШИ УКРАЇНСЬКОЮ, крім офіційних назв брендів, моделей і технологій.

Поверни тільки коректні дані відповідно до JSON-схеми.
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
        chat_template_kwargs: {
          enable_thinking: false,
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
