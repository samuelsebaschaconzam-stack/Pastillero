document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("waitlistForm");
  const emailInput = document.getElementById("em");
  const msg = document.getElementById("msg");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const correo = emailInput.value.trim();

      if (!correo || !correo.includes("@")) {
        msg.textContent = "Por favor, introduce un correo electrónico válido.";
        msg.style.color = "rgb(211, 47, 47)";
        return;
      }

      msg.textContent = `¡Listo! Hemos simulado el registro de ${correo} en la lista de espera.`;
      msg.style.color = "var(--ok)";
      emailInput.value = "";
    });
  }
});