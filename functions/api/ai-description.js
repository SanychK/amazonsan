
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

    
    const prompt = `
Ти — професійний український копірайтер інтернет-магазину AMAZONSAN.

ТВОЄ ЗАВДАННЯ:
Створи привабливий, зрозумілий і грамотний опис товару для покупців українською мовою.

ІНФОРМАЦІЯ ПРО ТОВАР:
Назва: ${title}
Модель: ${model || "Не вказана"}
Призначення: ${purpose || "Не вказано"}
Надані характеристики: ${suppliedSpecs || "Не надані"}

ОБОВ'ЯЗКОВІ ПРАВИЛА:
1. Використовуй тільки факти, які є у вхідних даних.
2. Не вигадуй характеристики, функції, технології, матеріали, переваги чи комплектацію.
3. Не додавай тверджень про якість, надійність, ефективність або сумісність, якщо цього немає у вхідних даних.
4. Не приписуй товару можливостей, які не зазначені в інформації.
5. Не вигадуй цифри, показники, режими роботи та результати.
6. Не повторюй технічні характеристики окремим списком.
7. Не використовуй порожні рекламні фрази на кшталт «найкращий вибір», «революційна якість», «ідеальний у всьому».
8. Пиши природно, грамотно та зрозуміло для звичайного покупця.
9. Зроби текст приємним для читання, розділи на короткі абзаци.
10. Не додавай заголовки «Характеристики», «Комплектація» або «Ключові слова».
11. Якщо інформації мало, створи короткий опис. Не заповнюй його вигаданими фактами.
12. Якщо немає достатньо інформації навіть для змістовного опису, поверни порожній рядок.
13. Не згадуй, що текст створений штучним інтелектом.

РЕЗУЛЬТАТ:
Поверни тільки готовий опис товару українською мовою у полі description.
`;

    const schema = {
      type: "object",
      properties: {
        description: { type: "string" }
      },
      required: ["description"],
      additionalProperties: false
    };

    const aiResponse = await env.AI.run(
      "@cf/zai-org/glm-4.7-flash",
      {
        messages: [
          {
            role: "system",
            content: "Створи опис виключно на основі наданих даних. Не вигадуй фактів. Поверни тільки JSON відповідно до заданої схеми.",
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
