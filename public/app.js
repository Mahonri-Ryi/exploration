const notesEl = document.getElementById("notes");
const emptyEl = document.getElementById("empty");
const healthEl = document.getElementById("health");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("note-input");

function render(notes) {
  notesEl.innerHTML = "";
  if (!notes.length) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "note";
    const text = document.createElement("p");
    text.className = "note__text";
    text.textContent = note.text;
    const meta = document.createElement("p");
    meta.className = "note__meta";
    meta.textContent = `#${note.id} · ${new Date(note.createdAt).toLocaleString()}`;
    li.append(text, meta);
    notesEl.appendChild(li);
  }
}

async function loadNotes() {
  const res = await fetch("/api/notes");
  const data = await res.json();
  render(data.notes);
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data.status === "ok") {
      healthEl.textContent = `API healthy · uptime ${data.uptime.toFixed(1)}s`;
      healthEl.classList.add("ok");
    }
  } catch {
    healthEl.textContent = "API unreachable";
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  inputEl.value = "";
  inputEl.focus();
  await loadNotes();
});

checkHealth();
loadNotes();
