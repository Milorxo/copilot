const monthYear = document.getElementById('month-year');
const daysEl = document.getElementById('days');
const prev = document.getElementById('prev');
const next = document.getElementById('next');

let date = new Date();

function renderCalendar() {
  const year = date.getFullYear();
  const month = date.getMonth();
  const today = new Date();

  monthYear.textContent = date.toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  // Get the first day and total days in the month
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  daysEl.innerHTML = '';

  // Add blank days before first day
  for (let i = 0; i < firstDay; i++) {
    daysEl.innerHTML += `<div></div>`;
  }

  // Add days
  for (let i = 1; i <= lastDate; i++) {
    const isToday =
      i === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    daysEl.innerHTML += `<div class="${isToday ? 'today' : ''}">${i}</div>`;
  }
}

prev.addEventListener('click', () => {
  date.setMonth(date.getMonth() - 1);
  renderCalendar();
});

next.addEventListener('click', () => {
  date.setMonth(date.getMonth() + 1);
  renderCalendar();
});

renderCalendar();
