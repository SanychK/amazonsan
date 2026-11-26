
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

    // Перевірка авторизації
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

    // Перевірка прав адміністратора
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

    // Отримання даних товару
    const body = await request.json();

    const title = String(body.title || "").trim();
    const brand = String(body.brand || "").trim();
    const model = String(body.model || "").trim();
    const purpose = String(body.purpose || "").trim();
    const suppliedSpecs = String(body.specs || "").trim();

    if (!title) {
      return json({ error: "Вкажи назву товару." }, 400);
    }

    if (!purpose && !suppliedSpecs) {
      return json({
        error: "Додай призначення або характеристики товару. Без цих даних неможливо створити достовірний опис."
      }, 422);
    }

    const prompt = `
Ти — помічник із підготовки описів товарів для каталогу AMAZONSAN.

ТВОЄ ЗАВДАННЯ:
Створи зрозумілий опис товару українською мовою ВИКЛЮЧНО на основі фактів, які наведені нижче.

ВХІДНІ ДАНІ:
Назва: ${title}
Бренд: ${brand || "Не вказаний"}
Модель: ${model || "Не вказана"}
Призначення: ${purpose || "Не вказано"}
Характеристики: ${suppliedSpecs || "Не надані"}

НАЙВАЖЛИВІШІ ПРАВИЛА:

1. Використовуй тільки інформацію з вхідних даних.
2. Не використовуй власні знання про схожі товари або моделі.
3. Не вигадуй жодних характеристик, функцій, технологій, матеріалів, розмірів, кольорів, потужності, сумісності чи комплектації.
4. Не додавай переваг, яких прямо не підтверджують вхідні дані.
5. Не роби припущень. Якщо факт не зазначений — не згадуй його.
6. Не перетворюй назву товару на твердження про його можливості.
7. Не додавай рекламних перебільшень.
8. Не вигадуй результати використання, ефективність, якість або надійність.
9. Не повторюй технічні характеристики окремим списком.
10. Не додавай заголовки «Характеристики» або «Комплектація».
11. Не копіюй просто назву товару замість опису.
12. Якщо інформації недостатньо для змістовного опису — поверни порожній рядок.
13. Не згадуй штучний інтелект.
14. Не додавай інформацію з пам'яті або загальних знань, навіть якщо вона здається тобі правильною.

СТИЛЬ:
Пиши грамотно, природно та зрозуміло для покупця.
Використовуй короткі абзаци.
Не намагайся зробити текст довшим за рахунок повторів.
Краще короткий достовірний опис, ніж довгий текст із непідтвердженими твердженнями.

ПОВЕРНИ ТІЛЬКИ JSON З ПОЛЕМ description.
`;

    const schema = {
      type: "object",
      properties: {
        description: { type: "string" },
      },
      required: ["description"],
      additionalProperties: false,
    };

    const aiResponse = await env.AI.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages: [
          {
            role: "system",
            content:
              "Ти працюєш із товарами каталогу. Заборонено додумувати або вигадувати факти. Використовуй виключно надані користувачем дані. Якщо даних недостатньо, поверни порожній description. Дотримуйся JSON-схеми.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "amazonsan_product_description",
            strict: true,
            schema,
          },
        },
        chat_template_kwargs: {
          enable_thinking: false,
        },
        max_completion_tokens: 1800,
        temperature: 0.1,
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
      return json({
        error: "AI не повернув опис. Спробуй ще раз.",
      }, 502);
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
        error: "Не вдалося розібрати відповідь AI.",
      }, 502);
    }

    const description = String(product?.description || "").trim();

    if (!description) {
      return json({
        error: "Недостатньо достовірної інформації для створення опису. Додай характеристики або призначення товару.",
      }, 422);
    }

    // Захист від повернення лише назви товару
    const normalizeText = (value) =>
      String(value || "")
        .toLocaleLowerCase("uk-UA")
        .replace(/[^\p{L}\p{N}]+/gu, "");

    const normalizedDescription = normalizeText(description);

    const forbiddenTexts = [
      normalizeText(title),
      normalizeText(`${title} ${model}`),
      normalizeText(`${model} ${title}`),
    ].filter(Boolean);

    if (forbiddenTexts.includes(normalizedDescription)) {
      return json({
        error: "AI повернув назву замість змістовного опису. Додай більше підтвердженої інформації.",
      }, 422);
    }

    // Бренд, модель і характеристики не генеруються AI.
    // Повертаються тільки ті значення, які надійшли від адміністратора.
    return json({
      description,
      brand,
      model,
      specs: suppliedSpecs,
      sources: [],
    });

  } catch (error) {
    return json({
      error: error?.message || "Помилка AI-помічника. Спробуй ще раз.",
    }, 500);
  }
}
