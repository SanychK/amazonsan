
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
Ти — помічник з пошуку та підготовки карток товарів для українського каталогу AMAZONSAN.

ГОЛОВНЕ ПРАВИЛО: ПРАВДИВІСТЬ ВАЖЛИВІША ЗА ПОВНОТУ.
Заповнюй тільки ті факти, які реально знайшов у джерелах і можеш пов’язати саме з указаною моделлю. Не вигадуй і не домислюй нічого, навіть якщо поле обов’язкове для красивої картки.

ВХІДНІ ДАНІ:
Назва товару: ${title}
Модель від користувача: ${model || "Не вказана"}
Призначення: ${purpose || "Не вказано"}
Додаткові дані від адміністратора: ${suppliedSpecs || "Не надано"}

ПОШУК І ПЕРЕВІРКА:
1. Шукай саме цей товар і точну модель, а не схожі товари.
2. Спочатку перевіряй офіційний сайт виробника та офіційну документацію.
3. Додатково використовуй сторінку саме цієї моделі на Amazon та інші надійні джерела.
4. Переконуйся, що кожен факт стосується потрібної моделі, її покоління та модифікації.
5. Не перенось характеристики з іншої моделі або схожого товару.
6. Не виводь характеристики з припущень, типових значень чи рекламних формулювань.
7. Якщо джерела суперечать одне одному або не дають чіткої відповіді — пропусти цей факт.
8. Якщо не можеш підтвердити факт джерелом — залиш відповідне поле порожнім або не додавай цей пункт.
9. Не вигадуй URL, джерела, сертифікати, сумісність, матеріали, функції чи комплектацію.
10. Не заповнюй поля лише для того, щоб картка виглядала повнішою.

КАТЕГОРІЇ AMAZONSAN:
${categories.join(", ")}

ПРАВИЛА ПОЛІВ:
- title: зрозуміла назва товару. Збережи точну модель, якщо вона підтверджена або вказана адміністратором. Не вигадуй нових позначень.
- brand: тільки бренд, підтверджений джерелом. Якщо не підтверджений — порожній рядок.
- model: тільки точна модель, підтверджена джерелом. Якщо не підтверджена — порожній рядок.
- category: обери категорію зі списку лише якщо тип товару зрозумілий. Інакше порожній рядок.
- subcategory: заповнюй лише якщо підкатегорія точно відповідає товару. Інакше порожній рядок.
- description: пиши українською лише на основі підтверджених фактів. Не вигадуй переваги, сценарії використання чи властивості. Якщо підтверджено замало інформації для змістовного опису — поверни порожній рядок. Не повторюй повністю технічні характеристики.
- specs: масив лише підтверджених технічних характеристик у форматі "Назва: значення". Не додавай бренд, модель, рекламні фрази або припущення. Якщо характеристик не знайдено — порожній масив.
- key_features: додай тільки конкретні переваги, прямо підтверджені джерелами. Не потрібно обов’язково набирати 3–7 пунктів. Якщо підтверджених переваг немає — порожній масив.
- package_contents: додавай тільки предмети, прямо зазначені виробником або надійним джерелом для комплекту саме цієї моделі. Не плутай стандартну комплектацію з аксесуарами, які продаються окремо. Якщо не підтверджено — порожній масив.
- keywords: додавай лише доречні пошукові слова, що відповідають підтвердженим назві, бренду, моделі й типу товару. Не вигадуй характеристики у ключових словах.
- image_search_query: точний запит для пошуку зображення цієї моделі. Не вигадуй посилань на фото.

ЗАБОРОНЕНО:
- Вигадувати відсутні дані.
- Підміняти невідоме типовим або ймовірним значенням.
- Називати товар найкращим, професійним, преміальним тощо без конкретного підтвердження.
- Додавати комплектацію за аналогією з іншими моделями.
- Повторювати бренд і модель у технічних характеристиках.
- Дублювати однакові характеристики чи речення.
- Заповнювати порожні поля загальними фразами.

УСІ ЗВИЧАЙНІ ТЕКСТОВІ ПОЛЯ ПИШИ УКРАЇНСЬКОЮ. Офіційні назви брендів, моделей і технологій залишай без перекладу.

Якщо інформації недостатньо, поверни частково заповнену картку. Порожнє поле означає, що даних не вдалося надійно підтвердити. Це правильний результат, а не помилка.

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
  try {
    product = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("JSON не знайдено");
    }

    product = JSON.parse(cleaned.slice(start, end + 1));
  }

  if (
    !product ||
    typeof product !== "object" ||
    Array.isArray(product)
  ) {
    throw new Error("Некоректна структура відповіді");
  }
} catch {
  return json({
    error: "AI не зміг сформувати коректну картку товару. Спробуй ще раз."
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
