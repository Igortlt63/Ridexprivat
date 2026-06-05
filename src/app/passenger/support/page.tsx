'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, MessageSquare, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const FAQ = [
  { q: 'Как создать заявку на поездку?', a: 'Перейдите в кабинет пассажира, нажмите "Создать заявку". Выберите точку отправления и назначения на карте, укажите вашу цену и пожелания.' },
  { q: 'Как работает торг с водителем?', a: 'Водитель может принять вашу цену или предложить свою. Вы увидите его предложение и сможете принять или отклонить. Можно ждать других предложений.' },
  { q: 'Что делать если водитель не приехал?', a: 'Вы можете отменить заявку в любой момент пока поездка не началась. Если водитель принят — напишите ему в чат внутри поездки.' },
  { q: 'Как оставить отзыв о водителе?', a: 'После завершения поездки на странице поездки появится форма для отзыва. Вы можете поставить оценку от 1 до 5 и написать комментарий.' },
  { q: 'Как изменить или отменить заявку?', a: 'Пока статус "Ищем водителя" или "Торг" — вы можете отменить заявку кнопкой внизу страницы поездки.' },
  { q: 'Безопасно ли использовать сервис?', a: 'Все водители проходят верификацию. В поездке доступен чат с водителем. При необходимости вы можете позвонить водителю напрямую.' },
]

export default function SupportPage() {
  const router = useRouter()
  const [openIdx, setOpenIdx]   = useState<number | null>(null)
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)

  async function sendMessage() {
    if (!message.trim()) return
    setSending(true)
    await new Promise(r => setTimeout(r, 1000))
    setSending(false)
    setMessage('')
    toast.success('Сообщение отправлено! Ответим в течение 24 часов.')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Поддержка</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Контакты */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-3">Связаться с нами</p>
          <div className="space-y-2">
            <a href="tel:+78001234567" className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <Phone className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">+7 (800) 123-45-67</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Бесплатно, пн-вс 8:00-22:00</p>
              </div>
            </a>
            <a href="mailto:support@ridexgo.ru" className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <Mail className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">support@ridexgo.ru</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Ответ в течение 24 часов</p>
              </div>
            </a>
          </div>
        </div>

        {/* Написать сообщение */}
        <div className="card p-4">
          <p className="font-semibold text-gray-900 dark:text-white mb-3">Написать в поддержку</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Опишите вашу проблему подробно..."
            className="input resize-none mb-3"
            rows={4}
          />
          <button onClick={sendMessage} disabled={sending || !message.trim()} className="btn-primary w-full">
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Отправляем...
              </span>
            ) : 'Отправить'}
          </button>
        </div>

        {/* FAQ */}
        <div className="card divide-y divide-gray-50 dark:divide-slate-800 overflow-hidden">
          <p className="font-semibold text-gray-900 dark:text-white px-4 py-3">Частые вопросы</p>
          {FAQ.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800 dark:text-slate-100 pr-3">{item.q}</span>
                {openIdx === i
                  ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                }
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
