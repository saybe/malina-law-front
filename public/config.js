/*
 * Необязательная настройка страницы. Правьте файл прямо в репозитории —
 * после следующего запуска GitHub Actions изменения попадут на сайт.
 *
 * jsonUrl — внешний источник данных в том же формате, что и data/acts.json.
 * Нужен, если из GitHub Actions не удаётся достучаться до
 * http://publication.pravo.gov.ru (например, сеть раннера его блокирует).
 * Подойдёт любой HTTPS-эндпоинт, отдающий JSON: Cloudflare Worker, Vercel
 * Function, свой сервер. Схема ответа описана в README.md.
 *
 * Пример:
 *   window.MALINA_CONFIG = { jsonUrl: 'https://law-proxy.example.workers.dev/acts' }
 *
 * Пока строка пустая, страница читает data/acts.json из этого же репозитория.
 */
window.MALINA_CONFIG = {
  jsonUrl: '',
}
