export function normalizeSearchText(value) {
  return String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replaceAll(/[^a-zа-я0-9]+/gi, ' ').trim();
}

const METAPHOR_RULES = [
  {
    pattern: /учеб|урок|школ|экзам|образован|лекци|заняти|знани|студент|обучен|учител|университет|вуз|подготов|конспект|курс|чтен|библиотек|саморазвит|развити|навык|study|education|learning|school|student|exam/,
    names: ['Книга', 'Ручка', 'Папка', 'Наушники'],
  },
  {
    pattern: /финанс|деньг|эконом|бюджет|покуп|кошелек|кошел|оплат|доход|расход|зарплат|накоплен|сбереж|инвест|банк|стоимост|цен[аыуе]|бизнес|прибыл|монетиз|богатств|капитал|finance|money|budget|income|saving|investment|shopping/,
    names: ['Кошелек', 'Монета'],
  },
  {
    pattern: /музык|звук|слуша|подкаст|аудио|песн|наушник|мелоди|концерт|плеер|голос|радио|саунд|шум|тишин|music|sound|listening|podcast|audio/,
    names: ['Наушники', 'Телефон'],
  },
  {
    pattern: /связ|звон|общен|сообщ|цифров|телефон|коммуникац|переписк|разговор|контакт|знакомств|социал|чат|смс|встреч|созвон|сотруднич|командн|отношен|друз|семь|поддержк|любов|довер|communication|message|call|contact|social|friend/,
    names: ['Телефон', 'Наушники'],
  },
  {
    pattern: /творч|рисова|иде|решен|задач|пазл|головолом|креатив|вдохнов|воображ|изобрет|придум|мозгов|мышлен|логик|инсайт|концепц|дизайн|проектирован|creativ|idea|inspiration|design|solution|puzzle/,
    names: ['Пазлы', 'Ручка', 'Книга'],
  },
  {
    pattern: /уют|интерьер|дом|декор|цвет|комнат|растен|цветок|цветы|природ|гармони|спокойств|отдых|релакс|атмосфер|красот|эстетик|украшен|уют|comfort|home|interior|decor|plant|flower|relax/,
    names: ['Ваза', 'Лампа'],
  },
  {
    pattern: /свет|работ|офис|организац|планир|порядок|продуктив|дедлайн|задач|процесс|карьер|професс|делов|расписан|менедж|управлен|проект|цель|фокус|концентр|эффектив|привычк|work|office|planning|productivity|career|task|goal|focus/,
    names: ['Лампа', 'Папка', 'Книга', 'Ручка'],
  },
  {
    pattern: /технолог|смартфон|гаджет|приложен|интернет|онлайн|сайт|цифровизац|электрон|данн|информац|сеть|мобильн|искусственн|нейросет|программ|кодирован|разработк|компьютер|стартап|technology|digital|online|internet|app|software|computer|startup|ai/,
    names: ['Телефон', 'Папка', 'Наушники'],
  },
  {
    pattern: /письм|запис|заметк|документ|бумаг|отчет|отчёт|архив|файл|список|чеклист|инструкц|договор|бумажн|оформлен|делопроизвод|note|document|file|paper|report/,
    names: ['Папка', 'Ручка', 'Книга'],
  },
  {
    pattern: /подар|праздник|сюрприз|поздрав|день рождения|торжеств|событи|воспомин|сувенир|gift|celebrat|birthday|memory/,
    names: ['Ваза', 'Кошелек', 'Монета'],
  },
  {
    pattern: /путешеств|поездк|отпуск|маршрут|туризм|чемодан|дорог|город|навиг|билет|приключен|экскурс|travel|trip|vacation|route|tourism/,
    names: ['Телефон', 'Книга', 'Кошелек'],
  },
  {
    pattern: /домашн|быт|уборк|хранен|переезд|обустройств|организован|household|moving|storage/,
    names: ['Папка', 'Ваза', 'Лампа'],
  },
];

const NAME_ALIASES = {
  книга: 'Книга', книг: 'Книга', книги: 'Книга', книжка: 'Книга', книжки: 'Книга', books: 'Книга', учебник: 'Книга', чтение: 'Книга', литература: 'Книга', энциклопедия: 'Книга',
  деньги: 'Кошелек', денежка: 'Кошелек', денежки: 'Кошелек', финансы: 'Кошелек', кошел: 'Кошелек', кошелек: 'Кошелек', кошелёк: 'Кошелек', кошельки: 'Кошелек', wallet: 'Кошелек',
  монеты: 'Монета', монетка: 'Монета', монет: 'Монета', coin: 'Монета',
  ламп: 'Лампа', лампочка: 'Лампа', лампы: 'Лампа', светильник: 'Лампа', освещение: 'Лампа', light: 'Лампа',
  ваз: 'Ваза', цветы: 'Ваза', цветок: 'Ваза', вазы: 'Ваза', ваза: 'Ваза', горшок: 'Ваза', растение: 'Ваза',
  ручк: 'Ручка', ручка: 'Ручка', ручки: 'Ручка', карандаш: 'Ручка', карандаши: 'Ручка', писать: 'Ручка', письмо: 'Ручка', pen: 'Ручка',
  папк: 'Папка', папка: 'Папка', папки: 'Папка', документы: 'Папка', документ: 'Папка', файл: 'Папка', файлы: 'Папка', folder: 'Папка',
  смартфон: 'Телефон', смартфоны: 'Телефон', мобильный: 'Телефон', мобильник: 'Телефон', телефон: 'Телефон', телефоны: 'Телефон', phone: 'Телефон',
  наушник: 'Наушники', гарнитура: 'Наушники', наушники: 'Наушники', музыка: 'Наушники', headphone: 'Наушники', headphones: 'Наушники',
  головоломка: 'Пазлы', пазл: 'Пазлы', пазлы: 'Пазлы', пазлик: 'Пазлы', puzzle: 'Пазлы', puzzles: 'Пазлы',
};

function resolveAlias(token) {
  return NAME_ALIASES[token]
    || Object.entries(NAME_ALIASES).find(([alias]) => alias.length >= 4 && token.startsWith(alias))?.[1]
    || null;
}

export function findComponentByName(name, candidates) {
  const query = normalizeSearchText(name);
  if (!query) return null;

  for (const token of query.split(' ').filter(Boolean)) {
    const resolvedAlias = resolveAlias(token);
    if (!resolvedAlias) continue;
    const aliased = candidates.find((item) => normalizeSearchText(item.name) === normalizeSearchText(resolvedAlias));
    if (aliased) return aliased;
  }

  return candidates.find((item) => normalizeSearchText(item.name) === query)
    || candidates.find((item) => {
      const itemName = normalizeSearchText(item.name);
      return itemName && (itemName.includes(query) || query.includes(itemName));
    })
    || null;
}

export function findMetaphorComponents(input, candidates) {
  const normalized = normalizeSearchText(input);
  if (!normalized) return [];
  const matched = [];
  const addByName = (name) => {
    const item = findComponentByName(name, candidates);
    if (item && !matched.some((entry) => entry.id === item.id)) matched.push(item);
  };

  METAPHOR_RULES
    .filter((rule) => rule.pattern.test(normalized))
    .flatMap((rule) => rule.names)
    .forEach(addByName);

  // Recognize component names and aliases embedded in longer titles, not only exact names.
  const queryTokens = normalized.split(' ').filter((token) => token.length >= 4);
  queryTokens.map(resolveAlias).filter(Boolean).forEach(addByName);
  candidates.forEach((item) => {
    const name = normalizeSearchText(item.name);
    if (name && normalized.includes(name)) addByName(item.name);
  });

  return matched;
}
