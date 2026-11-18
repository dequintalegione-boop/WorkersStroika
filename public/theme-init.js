// Применяем сохранённую тему до первой отрисовки React без inline JavaScript.
(function () {
  function applyTheme(theme) {
    if (!["light", "dark", "modern-dark"].includes(theme)) theme = "light";
    var root = document.documentElement;
    root.classList.remove("light", "dark", "modern-dark");
    if (theme === "light") root.classList.add("light");
    if (theme === "dark") root.classList.add("dark");
    if (theme === "modern-dark") root.classList.add("dark", "modern-dark");
    root.setAttribute("data-theme", theme);
  }
  var theme = "light";
  try {
    var saved = JSON.parse(localStorage.getItem("brigade-tracker-storage") || "{}");
    theme = saved && saved.state && saved.state.theme ? saved.state.theme : "light";
  } catch (_error) {
    // При повреждённом или недоступном хранилище используем тему по умолчанию.
  }
  applyTheme(theme);
})();
