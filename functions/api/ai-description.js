
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
    // Перевірка підключення AI
    if (!env.AI) {
      return json({ error: "AI не підключено до Cloudflare Pages." }, 503);
    }

    // Підключення до Supabase
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

    // Перевірка авторизації
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

    // Перевірка прав адміністратора
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

    // Отримання даних товару
    const body = await request.json();

    const title = String(body.title || "").trim().slice(0, 180);
    const model = String(body.model || "").trim().slice(0, 120);
    const purpose = String(body.purpose || "").trim().slice(0, 1000);
    const specs = String(body.specs || "").trim().slice(0, 3000);

    if (!title) {
      return json({ error: "Вкажи назву товару." }, 400);
    }

    if (!model && !purpose && !specs) {
      return json({
        error: "Додай модель, призначення або характеристики товару.",
      }, 400);
    }

    const userFacts = [
      `Назва товару: ${title}`,
      model ? `Модель: ${model}` : "",
      purpose ? `Призначення: ${purpose}` : "",
      specs ? `Підтверджені характеристики:\n${specs}` : "",
    ].filter(Boolean).join("\n");

    // Генерація опису через Cloudflare Workers AI
    const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
      messages: [
        {
          role: "system",
          content: `Ти — професійний українськомовний редактор товарного каталогу AMAZONSAN.

Створи привабливий, грамотний і структурований опис товару українською мовою.

Використовуй:
- короткий цікавий вступ;
- доречні підзаголовки;
- переваги товару;
- маркований список характеристик;
- помірну кількість доречних емодзі.

Пиши природно, зрозуміло, професійно та переконливо.

ВАЖЛИВО:
Використовуй виключно факти, надані користувачем.
Не вигадуй технічні характеристики, матеріали, сумісність, комплектацію, гарантію, сертифікати, країну виробництва або результати тестів.
Не видавай припущення за факти.
Якщо інформації недостатньо, не домислюй її та не створюй порожніх розділів.

Поверни лише готовий опис товару українською мовою.`
        },
        {
          role: "user",
          content: `Підготуй опис для картки товару на основі цих даних:\n\n${userFacts}`
        }
      ]
    });

    const description = String(result?.response || "").trim();

    if (!description) {
      return json({
        error: "AI не повернув готовий опис. Спробуй ще раз.",
      }, 502);
    }

    return json({ description });

  } catch (error) {
    console.error("AMAZONSAN AI description error:", error);
    return json({
      error: "Не вдалося створити опис. Перевір підключення та спробуй ще раз.",
    }, 500);
  }
}
