import { useEffect, useState } from 'react'
import './App.css'

type Task = {
  id: number
  text: string
  done: boolean
}

type Filter = 'all' | 'pending' | 'done'

const STORAGE_KEY = 'tasks-v1'

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Task[]) : []
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // Guarda las tareas cada vez que cambian
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // si el navegador bloquea el almacenamiento, la app sigue funcionando
    }
  }, [tasks])

  const addTask = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = text.trim()
    if (!clean) return
    setTasks((prev) => [{ id: Date.now(), text: clean, done: false }, ...prev])
    setText('')
  }

  const toggleTask = (id: number) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )

  const deleteTask = (id: number) =>
    setTasks((prev) => prev.filter((t) => t.id !== id))

  const clearDone = () => setTasks((prev) => prev.filter((t) => !t.done))

  const pendingCount = tasks.filter((t) => !t.done).length
  const doneCount = tasks.length - pendingCount

  const visible = tasks.filter((t) =>
    filter === 'all' ? true : filter === 'done' ? t.done : !t.done,
  )

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'done', label: 'Hechas' },
  ]

  return (
    <main className="todo">
      <h1>Mis tareas</h1>
      <p className="subtitle">
        {tasks.length === 0
          ? 'Agrega tu primera tarea'
          : `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} · ${doneCount} hecha${doneCount === 1 ? '' : 's'}`}
      </p>

      <form className="todo-form" onSubmit={addTask}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="¿Qué tienes que hacer?"
          aria-label="Nueva tarea"
        />
        <button type="submit" disabled={!text.trim()}>
          Agregar
        </button>
      </form>

      <div className="filters" role="group" aria-label="Filtrar tareas">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? 'active' : ''}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="task-list">
        {visible.map((task) => (
          <li key={task.id} className={task.done ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleTask(task.id)}
              />
              <span>{task.text}</span>
            </label>
            <button
              type="button"
              className="delete"
              onClick={() => deleteTask(task.id)}
              aria-label={`Eliminar ${task.text}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 && tasks.length > 0 && (
        <p className="empty">No hay tareas en este filtro.</p>
      )}

      {doneCount > 0 && (
        <button type="button" className="clear" onClick={clearDone}>
          Borrar completadas ({doneCount})
        </button>
      )}
    </main>
  )
}

export default App