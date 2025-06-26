// Select DOM elements
const form      = document.getElementById('task-form');
const input     = document.getElementById('task-input');
const listEl    = document.getElementById('task-list');

// Load tasks from localStorage or start with an empty array
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

// Render the task list
function render() {
  listEl.innerHTML = '';
  tasks.forEach((task, i) => {
    const li = document.createElement('li');

    // Checkbox
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = task.completed;
    chk.addEventListener('change', () => {
      tasks[i].completed = chk.checked;
      sync();
    });

    // Title
    const span = document.createElement('span');
    span.textContent = task.title;
    span.className = 'title' + (task.completed ? ' completed' : '');

    // Delete button
    const del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'delete';
    del.addEventListener('click', () => {
      tasks.splice(i, 1);
      sync();
    });

    li.append(chk, span, del);
    listEl.appendChild(li);
  });
}

// Save to localStorage and re-render
function sync() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
  render();
}

// Handle new-task submission
form.addEventListener('submit', e => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  tasks.unshift({ title, completed: false });
  input.value = '';
  sync();
});

// Initial render
render();
