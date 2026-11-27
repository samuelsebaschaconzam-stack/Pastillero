document.addEventListener("DOMContentLoaded", () => {
  const SESSION_ROL_KEY = "pastillero_rol_activo";
  const STORAGE_ADMIN_CFG = "pastillero_admin_cfg_v1";

  const DEFAULT_PINS = {
    admin: "1234",
    enfermero: "0000"
  };

  const ROLE_TITLES = {
    admin: "Administrador",
    enfermero: "Enfermero / Cuidador"
  };

  const roleCardsContainer = document.getElementById("role-cards");
  const pinForm = document.getElementById("pin-form");
  const pinLabel = document.getElementById("pin-label");
  const pinHint = document.getElementById("pin-hint");
  const pinInput = document.getElementById("pin-input");
  const btnToggleClave = document.getElementById("btn-toggle-clave");
  const pinError = document.getElementById("pin-error");
  const btnCancelarPin = document.getElementById("btn-cancelar-pin");

  let rolPendiente = null;

  function resetearVisibilidadClave() {
    if (!pinInput || !btnToggleClave) return;
    pinInput.type = "password";
    btnToggleClave.textContent = "Mostrar";
    btnToggleClave.setAttribute("aria-pressed", "false");
  }

  function guardarRolSesion(rol) {
    try {
      sessionStorage.setItem(SESSION_ROL_KEY, rol);
    } catch {
      try {
        window.name = `PASTILLERO_ROL:${rol}`;
      } catch {
        // Ignorar si no es accesible
      }
    }
  }

  function obtenerClaveRol(rol) {
    try {
      const raw = localStorage.getItem(STORAGE_ADMIN_CFG);
      if (!raw) return DEFAULT_PINS[rol] || "";
      const cfg = JSON.parse(raw);

      if (rol === "admin") {
        return typeof cfg.pinAdmin === "string" ? cfg.pinAdmin : DEFAULT_PINS.admin;
      }
      if (rol === "enfermero") {
        return typeof cfg.pinEnfermero === "string" ? cfg.pinEnfermero : DEFAULT_PINS.enfermero;
      }
      return "";
    } catch {
      return DEFAULT_PINS[rol] || "";
    }
  }

  function iniciarSesionConRol(rol) {
    guardarRolSesion(rol);
    window.location.assign("horarios_medicacion.html");
  }

  if (btnToggleClave && pinInput) {
    btnToggleClave.addEventListener("click", () => {
      const esOculta = pinInput.type === "password";
      pinInput.type = esOculta ? "text" : "password";
      btnToggleClave.textContent = esOculta ? "Ocultar" : "Mostrar";
      btnToggleClave.setAttribute("aria-pressed", String(esOculta));
      pinInput.focus();
    });
  }

  document.querySelectorAll(".role-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rol = btn.dataset.role;
      if (!rol) return;

      if (rol === "admin" || rol === "enfermero") {
        const claveRequerida = obtenerClaveRol(rol);
        if (claveRequerida && pinForm && roleCardsContainer) {
          rolPendiente = rol;
          roleCardsContainer.hidden = true;
          pinForm.hidden = false;
          resetearVisibilidadClave();
          if (pinLabel) pinLabel.textContent = `Clave de ${ROLE_TITLES[rol]}`;
          if (pinHint) {
            pinHint.textContent = `Ingresa el PIN o contraseña para acceder como ${ROLE_TITLES[rol]}.`;
          }
          if (pinError) pinError.hidden = true;
          if (pinInput) {
            pinInput.value = "";
            pinInput.focus();
          }
          return;
        }
      }

      iniciarSesionConRol(rol);
    });
  });

  if (pinForm) {
    pinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!rolPendiente) return;

      const claveRequerida = obtenerClaveRol(rolPendiente);
      const valorIngresado = pinInput ? pinInput.value.trim() : "";

      if (valorIngresado === claveRequerida) {
        iniciarSesionConRol(rolPendiente);
      } else if (pinError) {
        pinError.hidden = false;
        if (pinInput) pinInput.select();
      }
    });
  }

  if (btnCancelarPin) {
    btnCancelarPin.addEventListener("click", () => {
      rolPendiente = null;
      resetearVisibilidadClave();
      if (pinForm) pinForm.hidden = true;
      if (roleCardsContainer) roleCardsContainer.hidden = false;
      if (pinError) pinError.hidden = true;
    });
  }
});