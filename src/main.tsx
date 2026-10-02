import { createRoot } from 'react-dom/client'

// Токены темы и база идут первыми: от их порядка зависит разрешение
// переменных в остальных файлах. Дальше — компоненты со своими стилями.
import './styles.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
