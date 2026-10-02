/**
 * Точка входа для смоук-сборки: scripts/smoke.mjs рендерит эти компоненты
 * через react-dom/server. Лежит вне src/, чтобы не попасть в бандл страницы.
 */

export { default as App } from '../src/app/App.tsx'
export { default as ActCard } from '../src/entities/act/ui/ActCard.tsx'
export { default as Toolbar } from '../src/features/filters/ui/Toolbar.tsx'
export { default as Feed } from '../src/widgets/feed/ui/Feed.tsx'
export { default as DayGroup } from '../src/widgets/feed/ui/DayGroup.tsx'
export { default as StaleNotice } from '../src/widgets/feed/ui/StaleNotice.tsx'
