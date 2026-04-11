const BODY_PARTS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Abs",
  "Cardio",
];

const STORAGE_KEYS = {
  exercises: "pusher_exercises",
  calendar: "pusher_calendar_logs",
};

const LEGACY_STORAGE_KEYS = {
  exercises: "gymflow_exercises",
  calendar: "gymflow_calendar_logs",
};

const appState = {
  selectedBodyPart: BODY_PARTS[0],
  exercisesByBodyPart: {},
  calendarLogs: {},
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  editContext: null,
  selectedCalendarDate: null,
};

const bodyPartListEl = document.getElementById("bodyPartList");
const exercisePanelTitleEl = document.getElementById("exercisePanelTitle");
const exerciseListEl = document.getElementById("exerciseList");
const exerciseFormEl = document.getElementById("exerciseForm");
const exerciseNameInputEl = document.getElementById("exerciseName");
const exerciseWeightKgInputEl = document.getElementById("exerciseWeightKg");
const exerciseWeightLbInputEl = document.getElementById("exerciseWeightLb");
const exerciseRepsInputEl = document.getElementById("exerciseReps");

const editModalEl = document.getElementById("exerciseEditModal");
const editExerciseFormEl = document.getElementById("editExerciseForm");
const editExerciseNameEl = document.getElementById("editExerciseName");
const editWeightKgInputEl = document.getElementById("editWeightKg");
const editWeightLbInputEl = document.getElementById("editWeightLb");
const editRepsInputEl = document.getElementById("editReps");

const calendarGridEl = document.getElementById("calendarGrid");
const calendarMonthLabelEl = document.getElementById("calendarMonthLabel");
const prevMonthBtnEl = document.getElementById("prevMonthBtn");
const nextMonthBtnEl = document.getElementById("nextMonthBtn");

const calendarLogModalEl = document.getElementById("calendarLogModal");
const calendarLogFormEl = document.getElementById("calendarLogForm");
const calendarBodyPartOptionsEl = document.getElementById("calendarBodyPartOptions");
const calendarWorkoutRatingEl = document.getElementById("calendarWorkoutRating");
const calendarWorkoutRatingLabelEl = document.getElementById("calendarWorkoutRatingLabel");
const calendarLogDateLabelEl = document.getElementById("calendarLogDateLabel");
const clearCalendarDayBtnEl = document.getElementById("clearCalendarDayBtn");

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function toHumanDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function generateExerciseId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeExercise(item) {
  if (!item || typeof item !== "object") {
    return {
      id: generateExerciseId(),
      name: "",
      reps: 0,
      weightKg: 0,
      weightLb: 0,
      lastUpdated: todayDateString(),
    };
  }

  const legacyWeight = Number(item.weight);
  const weightKg = Number(item.weightKg);
  const weightLb = Number(item.weightLb);

  return {
    id: item.id || generateExerciseId(),
    name: String(item.name || ""),
    reps: Number(item.reps) || 0,
    weightKg: Number.isFinite(weightKg) ? weightKg : Number.isFinite(legacyWeight) ? legacyWeight : 0,
    weightLb: Number.isFinite(weightLb) ? weightLb : 0,
    lastUpdated: item.lastUpdated || todayDateString(),
  };
}

function normalizeCalendarEntry(entryValue) {
  if (typeof entryValue === "string") {
    return {
      bodyParts: BODY_PARTS.includes(entryValue) ? [entryValue] : [],
      rating: 3,
    };
  }

  if (entryValue && typeof entryValue === "object") {
    const rawParts = Array.isArray(entryValue.bodyParts)
      ? entryValue.bodyParts
      : typeof entryValue.bodyPart === "string"
        ? [entryValue.bodyPart]
        : [];
    const bodyParts = rawParts.filter((part) => BODY_PARTS.includes(part));
    const parsedRating = Number(entryValue.rating);
    return {
      bodyParts,
      rating: Math.min(5, Math.max(1, Number.isFinite(parsedRating) ? parsedRating : 3)),
    };
  }

  return {
    bodyParts: [],
    rating: 3,
  };
}

function loadStorage() {
  try {
    const exercisesRaw =
      localStorage.getItem(STORAGE_KEYS.exercises) || localStorage.getItem(LEGACY_STORAGE_KEYS.exercises);
    const calendarRaw =
      localStorage.getItem(STORAGE_KEYS.calendar) || localStorage.getItem(LEGACY_STORAGE_KEYS.calendar);

    appState.exercisesByBodyPart = exercisesRaw ? JSON.parse(exercisesRaw) : {};
    appState.calendarLogs = calendarRaw ? JSON.parse(calendarRaw) : {};
  } catch {
    appState.exercisesByBodyPart = {};
    appState.calendarLogs = {};
  }

  for (const part of BODY_PARTS) {
    if (!Array.isArray(appState.exercisesByBodyPart[part])) {
      appState.exercisesByBodyPart[part] = [];
    }
    appState.exercisesByBodyPart[part] = appState.exercisesByBodyPart[part].map(normalizeExercise);
  }

  Object.keys(appState.calendarLogs).forEach((dateKey) => {
    appState.calendarLogs[dateKey] = normalizeCalendarEntry(appState.calendarLogs[dateKey]);
  });
}

function saveExercises() {
  localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(appState.exercisesByBodyPart));
}

function saveCalendar() {
  localStorage.setItem(STORAGE_KEYS.calendar, JSON.stringify(appState.calendarLogs));
}

function renderBodyParts() {
  bodyPartListEl.innerHTML = "";
  for (const part of BODY_PARTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "body-part-item";
    if (part === appState.selectedBodyPart) {
      button.classList.add("active");
    }
    button.textContent = part;
    button.addEventListener("click", () => {
      appState.selectedBodyPart = part;
      renderBodyParts();
      renderExercises();
    });

    const li = document.createElement("li");
    li.append(button);
    bodyPartListEl.append(li);
  }
}

function renderExercises() {
  const currentPart = appState.selectedBodyPart;
  const exercises = appState.exercisesByBodyPart[currentPart];
  exercisePanelTitleEl.textContent = `${currentPart} Exercises`;
  exerciseListEl.innerHTML = "";

  if (!exercises.length) {
    const empty = document.createElement("div");
    empty.className = "exercise-empty";
    empty.textContent = `No exercises logged for ${currentPart} yet.`;
    exerciseListEl.append(empty);
    return;
  }

  exercises.forEach((exercise) => {
    const card = document.createElement("article");
    card.className = "exercise-card";

    const left = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = exercise.name;
    left.append(title);

    const meta = document.createElement("div");
    meta.className = "exercise-meta";
    meta.innerHTML = `
      <span class="badge">Weight: ${exercise.weightKg} kg</span>
      <span class="badge">Weight: ${exercise.weightLb} lb</span>
      <span class="badge">Reps: ${exercise.reps}</span>
      <span class="badge">Last Updated: ${toHumanDate(exercise.lastUpdated)}</span>
    `;
    left.append(meta);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-secondary";
    editBtn.textContent = "Edit / Update";
    editBtn.addEventListener("click", () => openExerciseEditModal(currentPart, exercise.id));

    card.append(left, editBtn);
    exerciseListEl.append(card);
  });
}

function addExercise(event) {
  event.preventDefault();

  const name = exerciseNameInputEl.value.trim();
  const weightKg = Number(exerciseWeightKgInputEl.value);
  const weightLb = Number(exerciseWeightLbInputEl.value);
  const reps = Number(exerciseRepsInputEl.value);

  if (
    !name ||
    Number.isNaN(weightKg) ||
    Number.isNaN(weightLb) ||
    Number.isNaN(reps) ||
    reps < 1 ||
    weightKg < 0 ||
    weightLb < 0
  ) {
    return;
  }

  appState.exercisesByBodyPart[appState.selectedBodyPart].push({
    id: generateExerciseId(),
    name,
    weightKg,
    weightLb,
    reps,
    lastUpdated: todayDateString(),
  });

  saveExercises();
  renderExercises();
  exerciseFormEl.reset();
  exerciseNameInputEl.focus();
}

function openExerciseEditModal(bodyPart, exerciseId) {
  const exercise = appState.exercisesByBodyPart[bodyPart].find((item) => item.id === exerciseId);
  if (!exercise) {
    return;
  }

  appState.editContext = { bodyPart, exerciseId };
  editExerciseNameEl.textContent = exercise.name;
  editWeightKgInputEl.value = String(exercise.weightKg);
  editWeightLbInputEl.value = String(exercise.weightLb);
  editRepsInputEl.value = String(exercise.reps);
  openModal(editModalEl);
}

function updateExercise(event) {
  event.preventDefault();
  if (!appState.editContext) {
    return;
  }

  const newWeightKg = Number(editWeightKgInputEl.value);
  const newWeightLb = Number(editWeightLbInputEl.value);
  const newReps = Number(editRepsInputEl.value);
  if (
    Number.isNaN(newWeightKg) ||
    Number.isNaN(newWeightLb) ||
    Number.isNaN(newReps) ||
    newReps < 1 ||
    newWeightKg < 0 ||
    newWeightLb < 0
  ) {
    return;
  }

  const { bodyPart, exerciseId } = appState.editContext;
  const exercise = appState.exercisesByBodyPart[bodyPart].find((item) => item.id === exerciseId);
  if (!exercise) {
    closeModal(editModalEl);
    return;
  }

  exercise.weightKg = newWeightKg;
  exercise.weightLb = newWeightLb;
  exercise.reps = newReps;
  exercise.lastUpdated = todayDateString();

  saveExercises();
  renderExercises();
  closeModal(editModalEl);
}

function getDateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function renderCalendar() {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDay = new Date(appState.viewYear, appState.viewMonth, 1);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(appState.viewYear, appState.viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(appState.viewYear, appState.viewMonth, 0).getDate();

  calendarMonthLabelEl.textContent = firstDay.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  calendarGridEl.innerHTML = "";
  weekdays.forEach((day) => {
    const dayLabel = document.createElement("div");
    dayLabel.className = "calendar-weekday";
    dayLabel.textContent = day;
    calendarGridEl.append(dayLabel);
  });

  const totalCells = 42;
  for (let cellIndex = 0; cellIndex < totalCells; cellIndex += 1) {
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";

    let dayNumber;
    let cellDate;
    let outsideMonth = false;

    if (cellIndex < startDayOfWeek) {
      dayNumber = prevMonthDays - startDayOfWeek + cellIndex + 1;
      cellDate = new Date(appState.viewYear, appState.viewMonth - 1, dayNumber);
      outsideMonth = true;
    } else if (cellIndex >= startDayOfWeek + daysInMonth) {
      dayNumber = cellIndex - startDayOfWeek - daysInMonth + 1;
      cellDate = new Date(appState.viewYear, appState.viewMonth + 1, dayNumber);
      outsideMonth = true;
    } else {
      dayNumber = cellIndex - startDayOfWeek + 1;
      cellDate = new Date(appState.viewYear, appState.viewMonth, dayNumber);
    }

    if (outsideMonth) {
      dayButton.classList.add("is-outside-month");
    }

    const dateKey = getDateKeyFromDate(cellDate);

    const numberEl = document.createElement("div");
    numberEl.className = "calendar-day-number";
    numberEl.textContent = String(dayNumber);
    dayButton.append(numberEl);

    const calendarEntry = appState.calendarLogs[dateKey];
    if (calendarEntry && calendarEntry.bodyParts.length) {
      dayButton.classList.add("logged");
      const bodyPartsLabel = calendarEntry.bodyParts.join(", ");
      dayButton.title = `${bodyPartsLabel} | Rating: ${calendarEntry.rating}/5`;

      const label = document.createElement("div");
      label.className = "calendar-day-label";
      label.textContent = bodyPartsLabel;
      dayButton.append(label);

      const ratingLabel = document.createElement("div");
      ratingLabel.className = "calendar-day-rating";
      ratingLabel.textContent = `Rating ${calendarEntry.rating}/5`;
      dayButton.append(ratingLabel);
    }

    dayButton.addEventListener("click", () => openCalendarLogModal(dateKey));
    calendarGridEl.append(dayButton);
  }
}

function createCalendarBodyPartCheckboxes() {
  calendarBodyPartOptionsEl.innerHTML = "";
  BODY_PARTS.forEach((part) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = part;
    checkbox.name = "calendarBodyPart";

    const text = document.createElement("span");
    text.textContent = part;

    label.append(checkbox, text);
    calendarBodyPartOptionsEl.append(label);
  });
}

function getSelectedCalendarBodyParts() {
  return Array.from(calendarBodyPartOptionsEl.querySelectorAll('input[type="checkbox"]:checked')).map(
    (checkbox) => checkbox.value
  );
}

function setSelectedCalendarBodyParts(parts) {
  Array.from(calendarBodyPartOptionsEl.querySelectorAll('input[type="checkbox"]')).forEach((checkbox) => {
    checkbox.checked = parts.includes(checkbox.value);
  });
}

function updateWorkoutRatingLabel(value) {
  calendarWorkoutRatingLabelEl.textContent = `${value} / 5`;
}

function openCalendarLogModal(dateKey) {
  appState.selectedCalendarDate = dateKey;
  calendarLogDateLabelEl.textContent = `Date: ${toHumanDate(dateKey)}`;

  const entry = normalizeCalendarEntry(appState.calendarLogs[dateKey]);
  setSelectedCalendarBodyParts(entry.bodyParts);
  calendarWorkoutRatingEl.value = String(entry.rating);
  updateWorkoutRatingLabel(entry.rating);

  openModal(calendarLogModalEl);
}

function saveCalendarLog(event) {
  event.preventDefault();
  const dateKey = appState.selectedCalendarDate;
  if (!dateKey) {
    return;
  }

  const selectedBodyParts = getSelectedCalendarBodyParts();
  if (!selectedBodyParts.length) {
    return;
  }

  appState.calendarLogs[dateKey] = {
    bodyParts: selectedBodyParts,
    rating: Number(calendarWorkoutRatingEl.value),
  };
  saveCalendar();
  renderCalendar();
  closeModal(calendarLogModalEl);
}

function clearCalendarDay() {
  const dateKey = appState.selectedCalendarDate;
  if (!dateKey) {
    return;
  }

  delete appState.calendarLogs[dateKey];
  saveCalendar();
  renderCalendar();
  closeModal(calendarLogModalEl);
}

function openModal(modalEl) {
  modalEl.classList.remove("hidden");
}

function closeModal(modalEl) {
  modalEl.classList.add("hidden");
  if (modalEl === editModalEl) {
    appState.editContext = null;
  }
  if (modalEl === calendarLogModalEl) {
    appState.selectedCalendarDate = null;
  }
}

function setupGlobalModalHandlers() {
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-close-modal");
      const modalEl = document.getElementById(modalId);
      closeModal(modalEl);
    });
  });

  [editModalEl, calendarLogModalEl].forEach((modalEl) => {
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) {
        closeModal(modalEl);
      }
    });
  });
}

function setupCalendarNavigation() {
  prevMonthBtnEl.addEventListener("click", () => {
    if (appState.viewMonth === 0) {
      appState.viewMonth = 11;
      appState.viewYear -= 1;
    } else {
      appState.viewMonth -= 1;
    }
    renderCalendar();
  });

  nextMonthBtnEl.addEventListener("click", () => {
    if (appState.viewMonth === 11) {
      appState.viewMonth = 0;
      appState.viewYear += 1;
    } else {
      appState.viewMonth += 1;
    }
    renderCalendar();
  });
}

function initializeApp() {
  loadStorage();
  createCalendarBodyPartCheckboxes();
  renderBodyParts();
  renderExercises();
  renderCalendar();
  setupGlobalModalHandlers();
  setupCalendarNavigation();

  exerciseFormEl.addEventListener("submit", addExercise);
  editExerciseFormEl.addEventListener("submit", updateExercise);
  calendarLogFormEl.addEventListener("submit", saveCalendarLog);
  clearCalendarDayBtnEl.addEventListener("click", clearCalendarDay);
  calendarWorkoutRatingEl.addEventListener("input", () => {
    updateWorkoutRatingLabel(calendarWorkoutRatingEl.value);
  });
  updateWorkoutRatingLabel(calendarWorkoutRatingEl.value);

  saveExercises();
  saveCalendar();
}

initializeApp();
