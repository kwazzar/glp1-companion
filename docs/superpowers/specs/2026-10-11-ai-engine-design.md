# GLP-1 Companion — AI Engine Demo: дизайн

Дата: 2026-10-11
Статус: утверждено в диалоге, ожидает ревью спеки

## 1. Цель

Тестовое задание: небольшая работающая демонстрация AI Engine, который ведёт
естественный персонализированный эмоциональный диалог на английском с
пользователем GLP-1 терапии. Сценарий: женщина 36 лет, Zepbound 3 месяца,
пятничный ритуал (заказ любимой еды после сложной недели) исчез из-за
снижения интереса к еде, появляется чувство пустоты.

AI должен: понять эмоциональный смысл, задать уместные уточняющие вопросы,
избегать шаблонных советов, помочь пользователю самостоятельно найти ОДИН
способ адаптации. Не предлагать менять препарат или дозировку.

### Результаты (deliverables)

1. Рабочее демо (веб-чат) по публичной ссылке (Vercel), доступное без установки.
2. `DESCRIPTION.md` — одностраничник (RU): модель/API, что настроено в AI
   Engine, почему ответы лучше базового чатбота.
3. `SCRIPT.md` — сценарий записи для пользователя: реплики пользователя под
   копипаст, с указанием ожидаемых ключевых моментов на каждом ходе.

Запись MP4 выполняет пользователь, не входит в задачи имплементации.

## 2. Стек и ограничения

- Next.js 16.4 (App Router), React 19, Tailwind 4, TypeScript — существующий каркас.
- SDK: `@google/genai`, модель `gemini-2.5-flash`.
  - `systemInstruction` — системный промпт.
  - `responseMimeType: "application/json"` + `responseSchema` — структурированный ответ.
  - temperature ≈ 0.8, maxOutputTokens ≈ 300 (запас на JSON-обёртку).
- Деплой: Vercel. Секрет `GEMINI_API_KEY` — в env (локально `.env.local`,
  на Vercel — Environment Variables). Ключ никогда не попадает в клиентский бандл.
- Без БД, без авторизации. Состояние сессии — в подписанной httpOnly-куке
  (JSON + HMAC-SHA256, секрет `SESSION_SECRET` в env).

Замечания по версии Next.js: `cookies()` из `next/headers` — асинхронный
(`await cookies()`); `middleware.js` в 16.x устарел (переименован в `proxy.js`)
и в решении не используется. Роут-хендлер: `app/api/chat/route.ts`.

## 3. Архитектура

```
Браузер (чат-UI, React)
   │  POST /api/chat {message}
   ▼
Route Handler (server, держит секреты и состояние)
   │
   ├─ 1. Safety layer ............ детерминированный префильтр (регэкспы)
   ├─ 2. Prompt assembly ......... system prompt + persona + memory + turn_context
   ├─ 3. Gemini Flash call ....... JSON-режим: {reply, stage, user_signal}
   ├─ 4. Stage validator ......... правила переходов, fallback на эвристику
   ├─ 5. Memory update ........... user_signal → профиль сессии
   ▼
Ответ {reply} + обновлённая кука состояния
```

### 3.1 Safety layer (до вызова модели)

Два независимых детектора на тексте пользователя (регэкспы по ключевым фразам):

- **Кризис** (self-harm, suicide, hopeless и близкие формы): вызов модели
  не выполняется. Возвращается фиксированный тёплый ответ с призывом
  обратиться в местную службу экстренной помощи / кризисную линию.
- **Депрессивный сигнал** (устойчивое состояние вне пятниц: сон, интерес,
  настроение, слова вроде "every day", "nothing helps"): ставится флаг
  `depression_concern` в состояние; промпт получает указание мягко предложить
  упомянуть об этом врачу. Не диагноз, не замена терапии.

Флаги заносятся в сессию и действуют до конца диалога.

### 3.2 Stage machine

Стадии: `reflect → explore → reframe → cocreate → close`.

- Модель в каждом ответе предлагает стадию (`stage`) и сигнал пользователя
  (`user_signal`).
- Валидатор движка: движение только вперёд, максимум на 1 стадию; минимум
  1 ход на каждой стадии; `close` доступна только после `cocreate`.
- Анти-застревание: если модель предлагает ту же стадию более 2 ходов
  подряд ИЛИ достигнут ход 8 без `cocreate` — движок принудительно
  переводит на следующую стадию (в `turn_context` передаётся причина).
- Бюджет диалога: 8 ходов до `cocreate`, максимум 12 ходов на сессию,
  затем принудительный `close`.
- Битый JSON от модели: 1 повтор запроса, затем fallback — движок
  определяет стадию эвристикой (счётчик ходов), текст ответа — просят
  у модели обычный текст повтором без JSON-режима. Крайний случай:
  запасная нейтральная реплика.

### 3.3 Memory (персонализация)

- `user_signal` из каждого ответа модели — короткая цитата-смысл из слов
  пользователя (например: "Friday was about reward and switching off after
  work") — добавляется в `memory` сессии (максимум 5 записей, компактно).
- `memory` реинжектится в каждый промпт — модель обязана опираться на её
  слова, а не на общие советы.
- Движок следит за размером состояния (см. риски: лимит куки 4KB).

### 3.4 Prompt assembly

Итоговый системный промпт = базовый промпт (ниже, §7) + карточка персоны +
текущая memory + `<turn_context>` (стадия, номер хода из бюджета, активные
флаги, причина принудительного перехода — если была).

Карточка персоны (вымышленная, задание разрешает только вымышленные данные):
женщина 36 лет, Zepbound 3 месяца, пятничный ритуал заказывать любимую еду
после рабочей недели, теперь почти не думает о еде, пятницы «опустели»,
чувствует пустоту и не знает, что с этим делать. Персона одна — скоуп демо
сознательно сужен (решение пользователя).

## 4. Контракты

### 4.1 API

`POST /api/chat`

- Запрос: `{ "message": string }` (1–2000 символов; пустое/длинное → 400).
- Ответ 200: `{ "reply": string }` + `Set-Cookie: glp_session=<signed>; HttpOnly; SameSite=Lax; Path=/`.
- Сбой модели (после retry): 200 с `{ "reply": fallback }` — тёплая запасная
  реплика, UI не знает про ошибки; сбой логируется на сервере.
- CORS не нужен: UI и API на одном origin.

### 4.2 Структура ответа модели (responseSchema)

```json
{
  "type": "object",
  "properties": {
    "reply":       { "type": "string" },
    "stage":       { "type": "string", "enum": ["reflect","explore","reframe","cocreate","close"] },
    "user_signal": { "type": "string" }
  },
  "required": ["reply","stage","user_signal"]
}
```

### 4.3 Состояние сессии (в куке, подписанной HMAC)

```ts
type Stage = "reflect"|"explore"|"reframe"|"cocreate"|"close";
type SessionState = {
  v: 1;
  stage: Stage;
  turn: number;                 // 1..12
  stageTurns: number;           // ходов на текущей стадии
  forced?: string;              // причина принудительного перехода
  depressionConcern: boolean;
  memory: string[];             // ≤5 записей user_signal
};
```

Размер состояния < 1KB — запас до лимита куки.

## 5. UI

Одна страница (замена `app/page.tsx`):

- Минималистичный чат на Tailwind: список сообщений, поле ввода, кнопка отправки.
- Пока ждём ответ — индикатор «печатает»; ответ показывается эффектом
  typewriter (псевдо-стриминг на клиенте: JSON-режим не стримится).
- Кнопка «New conversation»: сброс куки, чистый диалог.
- Под полем ввода — дисклеймер: не медицинский совет; при кризисе —
  экстренные службы.
- Демо-режим записи: над чатом компактная подсказка-персона (кто играет
  пользователь) — сворачиваемая, чтобы не мешать в кадре.

## 6. Тестирование

Vitest (dev-зависимость), только ядро движка — pure-функции без сети:

- Safety: кризис-фразы перехватываются; депрессивные — ставят флаг.
- Stage validator: запрет скачков назад/через стадию; минимальные ходы;
  анти-застревание (force-advance); бюджет 8/12.
- Memory: лимит 5 записей, FIFO.
- Prompt assembly: turn_context и память попадают в промпт; персона на месте.
- Cookie codec: round-trip подписи, отказ при подделке HMAC.

UI и живой вызов Gemini проверяются вручную по `SCRIPT.md` (чек-лист
приёмки: доходим до cocreate за ≤8 ходов, нет списков советов, нет
предложений менять дозу, один вопрос на реплику).

## 7. Системный промпт (финальная версия)

За основу взят промпт пользователя, внесены правки из диалога:
few-shot пара, антипопугайство, упоминание `<turn_context>`/turn-бюджета,
явные кризисные триггеры движка (упомянуты как флаги), требование опираться
на `<memory>`.

```
You are a warm, emotionally intelligent companion for people on GLP-1 medications.
You are not a doctor and not a therapist. Reply in English.

GOAL: help the user discover ONE adaptation that fits her life, in her own words.

HOW YOU TALK
- 2-4 short sentences per reply. Plain, human language. No headers, no bullet lists.
- Ask at most ONE question per reply, specific to what she just said.
- First reflect the emotional meaning, then ask. Never open with "I'm sorry to hear".
- Never give a list of generic tips (yoga, journaling, hobbies).
- Weave one of her phrases from <memory> in naturally; never quote her
  verbatim twice. Don't parrot mechanically.
- Respect <turn_context>: it tells you the current stage and how many turns
  remain. If turns are running low, move the conversation forward.

STAGES (the engine sets the stage in <turn_context>; follow it)
1 reflect: mirror the feeling and the loss of the Friday ritual.
2 explore: find what Friday actually gave her (reward, transition out of work,
  sensory pleasure, self-care, social moment). Don't assume, ask.
3 reframe: offer a tentative hypothesis and check whether it fits her.
4 cocreate: let HER propose the experiment. Only if she is stuck, offer at most
  two options built from her own words. End with one tiny, specific step for
  this coming Friday.
5 close: brief and warm, no new advice.

HARD RULES
- Never suggest changing, skipping, or adjusting medication or dose.
  If asked, say that's a question for her prescriber, then return to the feeling.
- If flags include "depression_concern": gently suggest mentioning these
  feelings to her doctor. Don't diagnose.
- If she mentions self-harm or being in crisis: respond with care and
  encourage contacting local emergency services or a crisis line.
- Don't claim the medication "causes" her feelings. It may be part of the picture.
- If she answers with one word or "idk", ask something easier, don't push.

GOOD vs BAD (match the good)
BAD: "I'm sorry to hear that. Have you tried journaling or going for walks?"
GOOD: "Fridays used to be your exhale after a long week — and now that
stillness feels empty. What did that Friday meal give you besides the food?"

Always answer with JSON: reply, stage (the stage you are moving to),
user_signal (in her words: what Friday gave her / how she feels, one short phrase).
```

Few-shot в промпте — одна пара GOOD/BAD (Flash держит тон на примерах).

## 8. Риски и их обработка

| Риск | Обработка |
|---|---|
| Gemini возвращает лишние/битые поля | Строгая валидация схемы; 1 retry; fallback на эвристику стадий |
| Кука > 4KB | memory ≤ 5 коротких записей; состояние < 1KB; тест на размер |
| Дрейф стадии (демо не дойдёт до cocreate) | force-advance по счётчику ходов; SCRIPT.md репетирует сценарий |
| Долгий ответ Flash (нет стрима в JSON-режиме) | typewriter на клиенте; индикатор «печатает» |
| Утечка ключа | Ключ только в server-side route handler; env, не в бандле |

## 9. Вне скоупа

Запись MP4 (делает пользователь), регистрация/авторизация, история диалогов,
БД, квиз, платежи, мобильное приложение, несколько персон, инструменты для
врачей, деплой собственной инфраструктуры.
