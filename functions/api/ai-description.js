
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
1. Обов'язково використовуй вебпошук для пошуку точної моделі товару.
2. Шукай за повною назвою, брендом і точним номером моделі.
3. Першочергово використовуй офіційний сайт виробника, офіційні технічні характеристики та інструкцію користувача.
4. Якщо офіційних даних недостатньо, перевіряй надійні незалежні джерела та сторінку саме цієї моделі на Amazon.
5. Не використовуй характеристики інших поколінь, модифікацій або схожих моделей.
6. Кожну технічну характеристику перевіряй окремо за знайденими джерелами.
7. Не вважай факт підтвердженим лише тому, що його повторюють інші сайти.
8. Якщо джерела суперечать одне одному, віддавай перевагу офіційній документації. Якщо суперечність не можна вирішити — пропусти характеристику.
9. Не перетворюй припущення на факти. Не доповнюй відсутні характеристики типовими значеннями.
10. Розрізняй тип конструкції, спосіб носіння, тип підключення, тип кабелю та спосіб заряджання. Не підміняй одне поняття іншим.
11. Для комплектації перевіряй саме стандартний комплект конкретної моделі. Не додавай аксесуари, які продаються окремо.
12. Використовуй точні значення, одиниці вимірювання та умови тестування з джерела.
13. Якщо характеристику не вдалося підтвердити — не додавай її.
14. Не вигадуй джерела, посилання або результати пошуку.
15. Якщо знайдено мало достовірної інформації, поверни коротку, але правдиву картку. Це краще, ніж повна картка з помилками.

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
- package_contents: додавай тільки предмети, наявність яких прямо підтверджена офіційною сторінкою виробника або інструкцією саме для цієї моделі та комплектації.
- Не використовуй комплектацію з відгуків, фотографій покупців або схожих моделей як доказ стандартного комплекту.
- Не додавай аксесуари, які можуть продаватися окремо.
- Не вигадуй адаптери, чохли, кабелі, перехідники, кріплення та інші додаткові предмети.
- Не створюй розширені, додаткові або альтернативні версії предметів, якщо виробник прямо їх не зазначає.
- Не повторюй один предмет під різними назвами.
- Якщо стандартну комплектацію неможливо підтвердити — поверни порожній масив.
- keywords: додавай лише доречні пошукові слова, що відповідають підтвердженим назві, бренду, моделі й типу товару. Не вигадуй характеристики у ключових словах.
- image_search_query: точний запит для пошуку зображення цієї моделі. Не вигадуй посилань на фото.

ЗАБОРОНЕНО:
ОБМЕЖЕННЯ КІЛЬКОСТІ ДАНИХ:
- specs: максимум 15 характеристик.
- key_features: максимум 6 переваг.
- package_contents: максимум 8 предметів комплектації.
- keywords: максимум 8 ключових слів.
- Не повторюй одну характеристику іншими словами.
- Не створюй десятки варіантів однієї характеристики.
- Час роботи, час заряджання та інші показники вказуй лише один раз для кожного окремого режиму, якщо такий режим прямо підтверджений.
- Не перетворюй одну характеристику на перелік вигаданих режимів.
- Якщо підтверджених даних багато, вибери найважливіші. Не намагайся вмістити все.
- Краще повернути коротку перевірену картку, ніж довгу незавершену відповідь.
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

let product = null;

for (let start = 0; start < cleaned.length; start++) {
  if (cleaned[start] !== "{") continue;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, i + 1));

          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            product = parsed;
          }
        } catch {
          // Продовжити пошук наступного JSON-об'єкта
        }

        break;
      }
    }
  }

  if (product) break;
}

if (!product) {
  return json({
    error: "Не вдалося розібрати відповідь AI.",
    diagnostics: {
      responseKeys: Object.keys(aiResponse || {}),
      choiceCount: aiResponse?.choices?.length || 0,
      messageKeys: Object.keys(message || {}),
      finishReason: aiResponse?.choices?.[0]?.finish_reason || null,
      contentType: typeof content,
      contentPreview:
        typeof content === "string"
          ? content.slice(0, 1200)
          : JSON.stringify(content)?.slice(0, 1200) || null
    }
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
