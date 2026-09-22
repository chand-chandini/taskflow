/* =========================================================
   STATE MANAGEMENT — single source of truth
   ========================================================= */
const State = {
  todos: [],
  filter: 'all',   // 'all' | 'active' | 'completed'
  darkMode: false,

  // Persistence
  save() {
    localStorage.setItem('taskflow', JSON.stringify({
      todos: this.todos,
      darkMode: this.darkMode,
    }));
  },
  load() {
    try {
      const raw = localStorage.getItem('taskflow');
      if (raw) {
        const data = JSON.parse(raw);
        this.todos = data.todos || [];
        this.darkMode = data.darkMode || false;
      }
    } catch (e) {
      console.warn('Failed to load state', e);
    }
  },

  // Derived getters
  getFiltered() {
    if (this.filter === 'active') return this.todos.filter(t => !t.completed);
    if (this.filter === 'completed') return this.todos.filter(t => t.completed);
    return this.todos;
  },
  getStats() {
    const total = this.todos.length;
    const completed = this.todos.filter(t => t.completed).length;
    return { total, completed, active: total - completed };
  },

  // Actions
  add(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    this.todos.unshift({
      id: Date.now() + Math.random(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    this.save();
    return true;
  },
  toggle(id) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      this.save();
    }
  },
  update(id, newText) {
    const trimmed = newText.trim();
    if (!trimmed) return false;
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.text = trimmed;
      this.save();
      return true;
    }
    return false;
  },
  remove(id) {
    this.todos = this.todos.filter(t => t.id !== id);
    this.save();
  },
  clearCompleted() {
    this.todos = this.todos.filter(t => !t.completed);
    this.save();
  },
  setFilter(filter) {
    this.filter = filter;
  },
  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    this.save();
  },
};

/* =========================================================
   COMPONENTS — small, focused render functions
   ========================================================= */

// ---- Header component
function Header() {
  return `
    <header class="app-header">
      <h1>Task<span>Flow</span></h1>
      <button class="theme-btn" data-action="toggle-theme" aria-label="Toggle dark mode">
        ${State.darkMode ? '☀️' : '🌙'}
      </button>
    </header>
  `;
}

// ---- Stats component
function Stats() {
  const { total, completed, active } = State.getStats();
  return `
    <section class="stats">
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${active}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${completed}</div>
        <div class="stat-label">Done</div>
      </div>
    </section>
  `;
}

// ---- Input form component
function TodoForm() {
  return `
    <form class="todo-form" data-action="add-todo">
      <input
        type="text"
        class="todo-input"
        placeholder="What needs to be done?"
        aria-label="New todo"
        maxlength="200"
        autocomplete="off"
      />
      <button type="submit" class="add-btn">Add</button>
    </form>
  `;
}

// ---- Filter tabs component
function Filters() {
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ];
  return `
    <div class="filters" role="tablist">
      ${filters.map(f => `
        <button
          class="filter-btn ${State.filter === f.key ? 'active' : ''}"
          data-filter="${f.key}"
          role="tab"
          aria-selected="${State.filter === f.key}"
        >${f.label}</button>
      `).join('')}
    </div>
  `;
}

// ---- Single Todo item component
function TodoItem(todo) {
  return `
    <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
      <input
        type="checkbox"
        class="todo-checkbox"
        ${todo.completed ? 'checked' : ''}
        aria-label="Mark as ${todo.completed ? 'incomplete' : 'complete'}"
      />
      <span class="todo-text" data-action="edit">${escapeHtml(todo.text)}</span>
      <div class="todo-actions">
        <button class="icon-btn delete" data-action="delete" aria-label="Delete">🗑️</button>
      </div>
    </li>
  `;
}

// ---- Empty state component
function EmptyState() {
  const messages = {
    all: 'No tasks yet. Add one above!',
    active: 'No active tasks. Great job!',
    completed: 'No completed tasks yet.',
  };
  return `
    <div class="empty">
      <div class="empty-icon">📝</div>
      <p>${messages[State.filter]}</p>
    </div>
  `;
}

// ---- TodoList component
function TodoList() {
  const todos = State.getFiltered();
  if (todos.length === 0) return EmptyState();
  return `
    <ul class="todo-list">
      ${todos.map(TodoItem).join('')}
    </ul>
  `;
}

// ---- Footer component
function Footer() {
  const { completed } = State.getStats();
  return `
    <footer class="app-footer">
      <span>${completed} completed</span>
      ${completed > 0
        ? `<button class="clear-btn" data-action="clear-completed">Clear completed</button>`
        : ''}
    </footer>
  `;
}

// ---- Root App component
function App() {
  return `
    <div class="app">
      ${Header()}
      ${Stats()}
      ${TodoForm()}
      ${Filters()}
      ${TodoList()}
      ${Footer()}
    </div>
  `;
}

/* =========================================================
   RENDER — re-render on every state change
   ========================================================= */
const root = document.getElementById('app');

function render() {
  document.body.classList.toggle('dark', State.darkMode);
  root.innerHTML = App();
  // Focus management: keep input focused if user is typing
  const input = root.querySelector('.todo-input');
  if (input && State._shouldFocusInput) {
    input.focus();
    State._shouldFocusInput = false;
  }
}

/* =========================================================
   EVENT HANDLING — single delegated listener
   ========================================================= */
function handleClick(e) {
  const target = e.target;

  // Toggle theme
  if (target.closest('[data-action="toggle-theme"]')) {
    State.toggleDarkMode();
    render();
    return;
  }

  // Filter buttons
  const filterBtn = target.closest('[data-filter]');
  if (filterBtn) {
    State.setFilter(filterBtn.dataset.filter);
    render();
    return;
  }

  // Clear completed
  if (target.closest('[data-action="clear-completed"]')) {
    State.clearCompleted();
    render();
    return;
  }

  // Todo actions (scoped inside a todo item)
  const todoItem = target.closest('.todo-item');
  if (!todoItem) return;

  const id = Number(todoItem.dataset.id);

  // Checkbox toggle
  if (target.classList.contains('todo-checkbox')) {
    State.toggle(id);
    render();
    return;
  }

  // Delete
  if (target.closest('[data-action="delete"]')) {
    State.remove(id);
    render();
    return;
  }

  // Edit (double-click the text)
  if (target.closest('[data-action="edit"]')) {
    startEdit(todoItem, id);
  }
}

function handleSubmit(e) {
  if (e.target.matches('[data-action="add-todo"]')) {
    e.preventDefault();
    const input = e.target.querySelector('.todo-input');
    if (State.add(input.value)) {
      State._shouldFocusInput = true;
      render();
    }
  }
}

/* =========================================================
   INLINE EDIT — contenteditable approach
   ========================================================= */
function startEdit(todoItem, id) {
  const textEl = todoItem.querySelector('.todo-text');
  textEl.contentEditable = 'true';
  textEl.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(textEl);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  function finish(save) {
    textEl.contentEditable = 'false';
    const newText = textEl.textContent;
    if (save) {
      if (State.update(id, newText)) {
        render();
        return;
      }
    }
    render(); // revert if invalid
  }

  textEl.addEventListener('blur', () => finish(true), { once: true });
  textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      textEl.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      textEl.removeEventListener('blur', () => finish(true));
      finish(false);
    }
  });
}

/* =========================================================
   UTILITIES
   ========================================================= */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   BOOT
   ========================================================= */
function init() {
  State.load();
  render();

  // Event delegation — attach once to the root
  root.addEventListener('click', handleClick);
  root.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', init);