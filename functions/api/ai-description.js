
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) {
      return json({ error: "AI не підключено до Cloudflare Pages." }, 503);
    }

    const supabaseUrl = (
      env.VITE_SUPABASE_URL || env.SUPABASE_URL || ""
    ).replace(/\/+$/, "");

    const supabaseKey =
      env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json({
        error: "Не знайдено змінні підключення Supabase у Cloudflare.",
      }, 503);
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return json({ error: "Увійди в акаунт адміністратора." }, 401);
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!authResponse.ok) {
      return json({ error: "Сесія завершилася. Увійди повторно." }, 401);
    }

    const user = await authResponse.json();

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!profileResponse.ok) {
      return json({
        error: "Не вдалося перевірити права адміністратора.",
      }, 403);
    }

    const profiles = await profileResponse.json();

    if (!profiles?.[0]?.is_admin) {
      return json({
        error: "AI-помічник доступний лише адміністратору.",
      }, 403);
    }

    const body = await request.json();

    const title = String(body.title || "").trim().slice(0, 180);
    const model = String(body.model || "").trim().slice(0, 120);
    const purpose = String(body.purpose || "").trim().slice(0, 1000);
    const specs = String(body.specs || "").trim().slice(0, 3000);

    if (!title) {
      return json({ error: "Вкажи назву товару." }, 400);
    }

    const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
      messages: [
        {
          role: "system",
          content: `Ти — дослідник товарів і професійний редактор каталогу AMAZONSAN.

ОБОВ'ЯЗКОВО використовуй вбудований пошук в інтернеті.

ПОШУК І ПЕРЕВІРКА:
1. Знайди товар за точною назвою та моделлю.
2. Спочатку перевір офіційний сайт виробника.
3. Додатково перевір Amazon та інші надійні джерела.
4. Переконайся, що знайдені характеристики стосуються саме цієї моделі та її модифікації.
5. Збери максимально повний перелік підтверджених характеристик.
6. Залежно від типу товару перевір розміри, вагу, матеріали, потужність, функції, живлення, акумулятор, підключення, сумісність, комплектацію та інші технічні параметри.
7. Не використовуй характеристики схожих моделей.
8. Якщо джерела суперечать одне одному, надавай перевагу офіційній інформації виробника.
9. Не вигадуй відсутні дані. Непідтверджені характеристики пропускай.

СТВОРЕННЯ ОПИСУ:
- Напиши повний, грамотний, привабливий опис українською мовою.
- Створи цікавий вступ.
- Опиши основні можливості та переваги.
- Поясни практичну користь товару.
- Додай окремий розділ із технічними характеристиками.
- Використовуй усі знайдені достовірні характеристики, а не лише кілька найважливіших.
- Структуруй текст короткими абзацами та підзаголовками.

ФОРМАТУВАННЯ:
- Використовуй звичайний текст.
- Для списків використовуй маркер •.
- НІКОЛИ не використовуй символи * або **.
- Не став зірочки після речень.
- Не використовуй Markdown-виділення.
- Не додавай декоративні символи в кінці речень.
- Емодзі використовуй помірно та доречно.

ЯКЩО ПОШУК НЕВДАЛИЙ:
Не вигадуй характеристики. Повідом, що товар не вдалося достовірно ідентифікувати, і попроси уточнити модель.

Поверни лише готовий опис українською мовою.`
        },
        {
          role: "user",
          content: `Знайди в інтернеті та підготуй повний опис саме цього товару.

Назва: ${title}
Модель: ${model || "Не вказана"}
Призначення: ${purpose || "Не вказано"}
Додаткові дані адміністратора: ${specs || "Немає"}

Потрібно знайти всі доступні достовірні характеристики та включити їх в опис.`
        }
      ],
      web_search_options: {
        search_context_size: "medium"
      },
      temperature: 0.2,
      max_completion_tokens: 2200,
      reasoning_effort: "low"
    });

    const message = result?.choices?.[0]?.message || {};

    const rawDescription =
      typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map(part => part?.text || "").join("\n")
          : result?.response || "";

    const description = String(rawDescription)
      .replace(/\r/g, "")
      .replace(/^\s*[-*]\s+/gm, "• ")
      .replace(/\*\*(.*?)\*\*/gs, "$1")
      .replace(/\*(.*?)\*/gs, "$1")
      .replace(/\*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const annotations = Array.isArray(message.annotations)
      ? message.annotations
      : [];

    const sources = annotations
      .map(item => item?.url_citation || item)
      .filter(item =>
        typeof item?.url === "string" &&
        /^https?:\/\//i.test(item.url)
      )
      .map(item => ({
        title: String(item.title || item.url).slice(0, 180),
        url: item.url
      }))
      .filter((item, index, all) =>
        all.findIndex(source => source.url === item.url) === index
      )
      .slice(0, 8);

    if (!description) {
      return json({
        error: "Не вдалося отримати опис. Уточни модель товару та спробуй ще раз.",
      }, 502);
    }

    return json({ description, sources });

  } catch (error) {
    console.error("AMAZONSAN AI description error:", error);

    return json({
      error: "Помилка під час пошуку або створення опису. Спробуй ще раз.",
    }, 500);
  }
}
