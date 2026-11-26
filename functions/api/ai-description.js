
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

    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
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

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
      },
    });

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

    if (!title) {
      return json({ error: "Вкажи назву товару." }, 400);
    }

    const categories = [
      {
        name: "Електроніка",
        subs: ["Смартфони та аксесуари", "Комп’ютери та ноутбуки", "Планшети та електронні книги", "Телевізори та аудіо", "Фото та відео", "Розумний дім", "Мережеве обладнання", "Ігрова техніка", "Кабелі та адаптери"]
      },
      {
        name: "Дім і кухня",
        subs: ["Кухонна техніка", "Кліматична техніка та охолодження", "Посуд", "Зберігання та організація", "Освітлення", "Декор", "Прибирання", "Меблі та аксесуари"]
      },
      {
        name: "Одяг і взуття",
        subs: ["Чоловічий одяг", "Жіночий одяг", "Дитячий одяг", "Взуття", "Сумки та гаманці", "Аксесуари"]
      },
      {
        name: "Краса та догляд",
        subs: ["Догляд за обличчям", "Догляд за волоссям", "Електроприлади краси", "Макіяж", "Особиста гігієна"]
      },
      {
        name: "Здоров’я",
        subs: ["Товари для здоров’я", "Масажери", "Медичні аксесуари", "Спорт і відновлення"]
      },
      {
        name: "Спорт і туризм",
        subs: ["Фітнес", "Туризм і кемпінг", "Велотовари", "Спортивний одяг", "Риболовля"]
      },
      {
        name: "Автотовари",
        subs: ["Автоелектроніка", "Інструменти для авто", "Аксесуари салону", "Догляд за авто"]
      },
      {
        name: "Дитячі товари",
        subs: ["Іграшки", "Товари для немовлят", "Навчання та творчість", "Дитяча кімната"]
      },
      {
        name: "Іграшки та хобі",
        subs: ["Конструктори", "Настільні ігри", "Моделі та колекціонування", "Творчість"]
      },
      {
        name: "Інструменти",
        subs: ["Ручні інструменти", "Електроінструменти", "Вимірювальні прилади", "Обладнання майстерні"]
      },
      {
        name: "Товари для тварин",
        subs: ["Для собак", "Для котів", "Годування", "Догляд та гігієна"]
      },
      {
        name: "Офіс і канцелярія",
        subs: ["Канцелярія", "Офісна техніка", "Меблі для офісу", "Папір та витратні матеріали"]
      },
      {
        name: "Продукти та напої",
        subs: ["Кава та чай", "Снеки", "Кухонні інгредієнти"]
      },
      {
        name: "Музика",
        subs: ["Музичні інструменти", "Аудіоаксесуари", "Студійне обладнання"]
      },
      {
        name: "Сад і город",
        subs: ["Садовий інструмент", "Полив", "Рослини та насіння", "Вуличне освітлення"]
      },
      {
        name: "Ювелірні вироби",
        subs: ["Прикраси", "Годинники", "Аксесуари"]
      },
      {
        name: "Багаж і подорожі",
        subs: ["Валізи", "Рюкзаки", "Дорожні аксесуари"]
      },
      {
        name: "Товари для бізнесу",
        subs: ["Торгівельне обладнання", "Пакування", "Промислові товари"]
      },
      {
        name: "Інше",
        subs: ["Інші товари"]
      }
    ];

    const prompt = `
Ти — професійний редактор товарного каталогу AMAZONSAN.
На основі ОДНІЄЇ назви товару підготуй заповнену картку товару українською мовою.

НАЗВА ТОВАРУ:
${title}

ПОТРІБНО ЗАПОВНИТИ ВСІ ПОЛЯ:

1. description — привабливий, грамотний і природний опис для покупця.
Поясни, що це за товар, для чого він призначений і чим може бути корисний.
Не повторюй механічно назву. Не використовуй порожні рекламні фрази.
Пиши змістовно, читабельно, короткими абзацами.
Не вигадуй конкретні функції, матеріали, технології, комплектацію або переваги.

2. purpose — зрозуміле призначення товару.
Самостійно сформулюй, для чого зазвичай використовують товар такого типу та кому він може бути корисний.
Не додавай непідтверджених особливостей конкретної моделі.

3. brand — бренд.
Заповнюй лише тоді, коли бренд чітко зазначений або однозначно впізнається в назві.
Інакше поверни порожній рядок.

4. model — модель.
Витягни точне позначення моделі з назви, якщо воно там є.
Не вигадуй модель. Якщо її немає — порожній рядок.

5. specs — характеристики.
Вкажи лише ті характеристики, які прямо зазначені в назві або які можна впевнено встановити без припущень.
Не вигадуй числові значення, потужність, розміри, матеріали, сумісність, час роботи, комплектацію та інші параметри.
Якщо достовірних характеристик немає — поверни порожній рядок.
Кожну характеристику пиши з нового рядка у форматі Назва: значення.

6. category та subcategory — вибери найбільш відповідні категорію і підкатегорію ВИКЛЮЧНО зі списку нижче.
Якщо точну підкатегорію визначити неможливо — вибери найближчу відповідну.
Не створюй власних назв категорій.

ДОЗВОЛЕНІ КАТЕГОРІЇ:
${JSON.stringify(categories)}

ВАЖЛИВО:
- Не проси додаткових даних.
- Не повертай запитань.
- Не вигадуй конкретні характеристики товару.
- Не додавай джерела, яких фактично не перевіряв.
- Усі текстові поля заповнюй українською.
- Поверни тільки JSON відповідно до заданої схеми.
`;

    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
        purpose: { type: "string" },
        brand: { type: "string" },
        model: { type: "string" },
        specs: { type: "string" },
        category: { type: "string" },
        subcategory: { type: "string" }
      },
      required: [
        "description",
        "purpose",
        "brand",
        "model",
        "specs",
        "category",
        "subcategory"
      ],
      additionalProperties: false
    };

    const aiResponse = await env.AI.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages: [
          {
            role: "system",
            content:
              "Ти створюєш картки товарів українською мовою. Поверни всі поля JSON. Не вигадуй точні технічні характеристики, бренд або модель. Призначення та категорію визначай за типом товару. Дотримуйся JSON-схеми."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "amazonsan_product_card",
            strict: true,
            schema
          }
        },
        chat_template_kwargs: {
          enable_thinking: false
        },
        max_completion_tokens: 2400,
        temperature: 0.2,
        reasoning_effort: "low"
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
      content = content.map((part) => part.text || "").join("");
    }

    if (content && typeof content === "object") {
      content = JSON.stringify(content);
    }

    if (typeof content !== "string" || !content.trim()) {
      return json({ error: "AI не повернув дані товару. Спробуй ще раз." }, 502);
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let product;

    try {
      product = JSON.parse(cleaned);
    } catch {
      return json({ error: "Не вдалося розібрати відповідь AI." }, 502);
    }

    const category = categories.find((item) => item.name === product.category);
    const subcategory = category?.subs.includes(product.subcategory)
      ? product.subcategory
      : category?.subs[0] || "Інші товари";

    const description = String(product.description || "").trim();
    const purpose = String(product.purpose || "").trim();

    if (!description || !purpose) {
      return json({
        error: "AI не зміг підготувати повну картку товару. Спробуй ще раз."
      }, 422);
    }

    return json({
      description,
      purpose,
      brand: String(product.brand || "").trim(),
      model: String(product.model || "").trim(),
      specs: String(product.specs || "").trim(),
      category: category?.name || "Інше",
      subcategory: category ? subcategory : "Інші товари",
      sources: []
    });

  } catch (error) {
    return json({
      error: error?.message || "Помилка AI-помічника. Спробуй ще раз."
    }, 500);
  }
}
