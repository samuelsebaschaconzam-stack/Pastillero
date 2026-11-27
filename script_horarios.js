document.addEventListener("DOMContentLoaded", () => {
  // --- 1.verificacion rol---
  const SESSION_ROL_KEY = "pastillero_rol_activo";
  const rolesValidos = ["admin", "enfermero", "usuario"];

  function leerRolSesion() {
    try {
      const desdeSession = sessionStorage.getItem(SESSION_ROL_KEY);
      if (rolesValidos.includes(desdeSession)) return desdeSession;
    } catch {

    }
    try {
      if (typeof window.name === "string" && window.name.startsWith("PASTILLERO_ROL:")) {
        const desdeName = window.name.replace("PASTILLERO_ROL:", "").trim();
        if (rolesValidos.includes(desdeName)) return desdeName;
      }
    } catch {

    }
    return null;
  }

  const rolSesion = leerRolSesion();

  if (!rolSesion) {
    window.location.assign("login.html");
    return;
  }

  // --- 2.claves de inicio y demas de inicio---
  const STORAGE_MEDS = "pastillero_medicamentos_v2";
  const STORAGE_HISTORIAL = "pastillero_historial_dias_v2";
  const STORAGE_AVISOS = "pastillero_avisos_v2";
  const STORAGE_ADMIN_CFG = "pastillero_admin_cfg_v1";

  let rolActual = rolSesion;
  let calendarioExpandido = false;

  const ahora = new Date();
  const fechaHoyReal = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  let fechaSeleccionada = new Date(fechaHoyReal);
  let mesVisible = new Date(fechaHoyReal.getFullYear(), fechaHoyReal.getMonth(), 1);

  const datosIniciales = [
    { id: 1, nombre: "Complejo B 50 mg", cantidad: 1, unidad: "comprimido", hora: "08:00", nota: "con el desayuno", tipo: "fijo", dias: ["L","M","X","J","V","S","D"] },
    { id: 2, nombre: "Vitamina D", cantidad: 1, unidad: "cápsula", hora: "08:00", nota: "", tipo: "fijo", dias: ["L","M","X","J","V","S","D"] },
    { id: 3, nombre: "Ibuprofeno 850 mg", cantidad: 0.5, unidad: "comprimido", hora: "14:00", nota: "después de comer", tipo: "fijo", dias: ["L","M","X","J","V","S","D"] },
    { id: 4, nombre: "Paracetamol 20 mg", cantidad: 1, unidad: "comprimido", hora: "21:00", nota: "", tipo: "fijo", dias: ["L","M","X","J","V","S","D"] },
    { id: 5, nombre: "Neuryl", cantidad: 10, unidad: "gotas", hora: "22:30", nota: "antes de dormir", tipo: "fijo", dias: ["L","M","X","J","V","S","D"] },
    { id: 6, nombre: "Ibuprofeno 400 mg", cantidad: 1, unidad: "comprimido", nota: "si hay más dolor de cabeza", tipo: "caso", max: 3 },
    { id: 7, nombre: "Loratadina 10 mg", cantidad: 0.5, unidad: "comprimido", nota: "si hay síntomas de alergia", tipo: "caso", max: 1 }
  ];

  let medicamentos = JSON.parse(localStorage.getItem(STORAGE_MEDS)) || JSON.parse(JSON.stringify(datosIniciales));
  let historialDias = JSON.parse(localStorage.getItem(STORAGE_HISTORIAL)) || {};
  let avisos = JSON.parse(localStorage.getItem(STORAGE_AVISOS)) || [];
  let adminConfig = JSON.parse(localStorage.getItem(STORAGE_ADMIN_CFG)) || {
    pacienteNombre: "",
    pacienteContacto: "",
    pacienteAlergias: "",
    pinAdmin: "1234",
    pinEnfermero: "0000"
  };

  function guardarMeds() {
    localStorage.setItem(STORAGE_MEDS, JSON.stringify(medicamentos));
  }

  function guardarHistorial() {
    localStorage.setItem(STORAGE_HISTORIAL, JSON.stringify(historialDias));
  }

  function guardarAvisos() {
    localStorage.setItem(STORAGE_AVISOS, JSON.stringify(avisos));
  }

  function guardarAdminConfig() {
    localStorage.setItem(STORAGE_ADMIN_CFG, JSON.stringify(adminConfig));
  }

  // --- 3.fechas y estados---
  const nombresMes = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const nombresDiaLargo = [
    "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
  ];
  const nombresDiaCorto = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const mapaDiaAbreviado = ["D", "L", "M", "X", "J", "V", "S"];

  function formatearClaveFecha(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function obtenerEstadoTemporal(dateObj) {
    const tSel = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
    const tHoy = fechaHoyReal.getTime();
    if (tSel < tHoy) return "pasado";
    if (tSel > tHoy) return "futuro";
    return "hoy";
  }

  function obtenerRegistroDia(dateObj) {
    const clave = formatearClaveFecha(dateObj);
    if (!historialDias[clave]) {
      historialDias[clave] = { tomadas: {}, prn: {}, etiquetas: [], notaTurno: "" };
    }
    return historialDias[clave];
  }

  function diaTieneActividad(clave) {
    const reg = historialDias[clave];
    if (!reg) return false;
    const hayTomas = Object.keys(reg.tomadas || {}).length > 0;
    const hayPrn = Object.values(reg.prn || {}).some(v => v > 0);
    const hayBitacora = (reg.etiquetas && reg.etiquetas.length > 0) || Boolean(reg.notaTurno);
    return hayTomas || hayPrn || hayBitacora;
  }

  // --- 4.confi roles y admin panel---
  const badgeRol = document.getElementById("badge-rol");
  const panelForm = document.getElementById("panel-formulario");
  const mainGrid = document.getElementById("main-grid");
  const btnPanelAdmin = document.getElementById("btn-panel-admin");
  const modalAdmin = document.getElementById("modal-admin");

  const nombresRol = {
    admin: "Administrador",
    enfermero: "Enfermero / Cuidador",
    usuario: "Usuario / Paciente"
  };

  function inicializarVistaPorRol() {
    badgeRol.textContent = `Rol: ${nombresRol[rolActual]}`;

    if (rolActual === "admin") {
      panelForm.hidden = false;
      mainGrid.classList.remove("single-col");
      btnPanelAdmin.hidden = false;
    } else if (rolActual === "enfermero") {
      panelForm.hidden = false;
      mainGrid.classList.remove("single-col");
      btnPanelAdmin.hidden = true;
    } else {
      panelForm.hidden = true;
      mainGrid.classList.add("single-col");
      btnPanelAdmin.hidden = true;
    }
  }

  document.getElementById("btn-cambiar-rol").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_ROL_KEY);
    window.location.href = "login.html";
  });

  btnPanelAdmin.addEventListener("click", () => {
    if (rolActual !== "admin") return;
    document.getElementById("adm-pin").value = adminConfig.pinAdmin !== undefined ? adminConfig.pinAdmin : "1234";
    document.getElementById("adm-pin-enfermero").value = adminConfig.pinEnfermero !== undefined ? adminConfig.pinEnfermero : "0000";
    modalAdmin.hidden = false;
  });

  document.getElementById("btn-cerrar-admin").addEventListener("click", () => {
    modalAdmin.hidden = true;
  });

  document.getElementById("btn-guardar-pin").addEventListener("click", () => {
    if (rolActual !== "admin") return;
    const nuevoPinAdmin = document.getElementById("adm-pin").value.trim();
    const nuevoPinEnfermero = document.getElementById("adm-pin-enfermero").value.trim();

    adminConfig.pinAdmin = nuevoPinAdmin;
    adminConfig.pinEnfermero = nuevoPinEnfermero;
    guardarAdminConfig();
    alert("Claves de acceso actualizadas.");
  });

  document.getElementById("btn-limpiar-dia").addEventListener("click", () => {
    if (rolActual !== "admin") return;
    const clave = formatearClaveFecha(fechaSeleccionada);
    if (confirm(`¿Borrar todos los registros y notas del día ${clave}?`)) {
      delete historialDias[clave];
      guardarHistorial();
      renderizarCalendario();
      renderizarTodoElDia();
      alert("Historial del día eliminado.");
    }
  });

  document.getElementById("btn-restaurar-demo").addEventListener("click", () => {
    if (rolActual !== "admin") return;
    if (confirm("¿Restaurar la lista inicial de medicamentos de ejemplo? Se reemplazará el horario actual.")) {
      medicamentos = JSON.parse(JSON.stringify(datosIniciales));
      guardarMeds();
      renderizarTodoElDia();
      modalAdmin.hidden = true;
    }
  });

  document.getElementById("btn-borrar-todo").addEventListener("click", () => {
    if (rolActual !== "admin") return;
    if (confirm("¿Estás seguro de que deseas borrar TODO el horario de medicación? Esta acción no se puede deshacer.")) {
      medicamentos = [];
      guardarMeds();
      renderizarTodoElDia();
      modalAdmin.hidden = true;
    }
  });

  function renderizarFichaPaciente() {
    const banner = document.getElementById("ficha-banner");
    const nombreEl = document.getElementById("ficha-nombre-txt");
    const contactoEl = document.getElementById("ficha-contacto-txt");
    const alergiaEl = document.getElementById("ficha-alergia-badge");

    const hayDatos = adminConfig.pacienteNombre || adminConfig.pacienteContacto || adminConfig.pacienteAlergias;
    if (!hayDatos) {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    nombreEl.textContent = adminConfig.pacienteNombre ? `Paciente: ${adminConfig.pacienteNombre}` : "Paciente registrado";
    contactoEl.textContent = adminConfig.pacienteContacto ? `· Contacto: ${adminConfig.pacienteContacto}` : "";

    if (adminConfig.pacienteAlergias) {
      alergiaEl.hidden = false;
      alergiaEl.textContent = `⚠ Alergias: ${adminConfig.pacienteAlergias}`;
    } else {
      alergiaEl.hidden = true;
    }
  }

  // --- 5.avisos---
  const avisosBoard = document.getElementById("avisos-board");
  const listaAvisos = document.getElementById("lista-avisos");

  function renderizarAvisos() {
    if (avisos.length === 0) {
      avisosBoard.hidden = true;
      return;
    }
    avisosBoard.hidden = false;
    listaAvisos.innerHTML = "";
    const puedeGestionarAvisos = (rolActual === "admin" || rolActual === "enfermero");

    avisos.forEach(aviso => {
      const li = document.createElement("li");
      li.className = `aviso-item ${aviso.nivel}`;
      li.innerHTML = `
        <div class="aviso-content">
          <strong>${aviso.texto}</strong>
          <span class="aviso-meta">Publicado por ${aviso.autor} · ${aviso.fechaHora}</span>
        </div>
        ${puedeGestionarAvisos ? `<button type="button" class="btn-del-med" title="Quitar aviso">Resolver</button>` : ""}
      `;
      if (puedeGestionarAvisos) {
        li.querySelector(".btn-del-med").addEventListener("click", () => {
          avisos = avisos.filter(a => a.id !== aviso.id);
          guardarAvisos();
          renderizarAvisos();
        });
      }
      listaAvisos.appendChild(li);
    });
  }

  document.getElementById("btn-publicar-aviso").addEventListener("click", () => {
    if (rolActual !== "admin" && rolActual !== "enfermero") return;
    const inputTexto = document.getElementById("aviso-texto");
    const nivel = document.getElementById("aviso-nivel").value;
    const texto = inputTexto.value.trim();

    if (!texto) {
      alert("Escribe el mensaje del aviso antes de publicarlo.");
      return;
    }

    const ahoraMsg = new Date();
    const horaStr = `${String(ahoraMsg.getHours()).padStart(2, "0")}:${String(ahoraMsg.getMinutes()).padStart(2, "0")}`;
    const fechaStr = `${ahoraMsg.getDate()} de ${nombresMes[ahoraMsg.getMonth()]} a las ${horaStr}`;

    avisos.unshift({
      id: Date.now(),
      texto,
      nivel,
      autor: nombresRol[rolActual],
      fechaHora: fechaStr
    });

    inputTexto.value = "";
    guardarAvisos();
    renderizarAvisos();
  });

  // --- 6.calendario mini y normal---
  const calTitulo = document.getElementById("cal-titulo");
  const weekStrip = document.getElementById("week-strip");
  const calFullWrapper = document.getElementById("cal-full-wrapper");
  const calDays = document.getElementById("cal-days");
  const btnToggleCal = document.getElementById("btn-toggle-cal");
  const btnIrHoy = document.getElementById("btn-ir-hoy");

  btnToggleCal.addEventListener("click", () => {
    calendarioExpandido = !calendarioExpandido;
    calFullWrapper.hidden = !calendarioExpandido;
    weekStrip.hidden = calendarioExpandido;
    btnToggleCal.textContent = calendarioExpandido ? "Minimizar calendario" : "Expandir mes";
    btnToggleCal.setAttribute("aria-expanded", String(calendarioExpandido));
    renderizarCalendario();
  });

  btnIrHoy.addEventListener("click", () => {
    fechaSeleccionada = new Date(fechaHoyReal);
    mesVisible = new Date(fechaHoyReal.getFullYear(), fechaHoyReal.getMonth(), 1);
    renderizarCalendario();
    renderizarTodoElDia();
  });

  document.getElementById("cal-prev").addEventListener("click", () => {
    if (calendarioExpandido) {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1);
    } else {
      fechaSeleccionada = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate() - 7);
      mesVisible = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1);
      renderizarTodoElDia();
    }
    renderizarCalendario();
  });

  document.getElementById("cal-next").addEventListener("click", () => {
    if (calendarioExpandido) {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1);
    } else {
      fechaSeleccionada = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate() + 7);
      mesVisible = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1);
      renderizarTodoElDia();
    }
    renderizarCalendario();
  });

  function renderizarCalendario() {
    const anio = calendarioExpandido ? mesVisible.getFullYear() : fechaSeleccionada.getFullYear();
    const mes = calendarioExpandido ? mesVisible.getMonth() : fechaSeleccionada.getMonth();
    calTitulo.textContent = `${nombresMes[mes]} ${anio}`;

    const claveHoy = formatearClaveFecha(fechaHoyReal);
    const claveSel = formatearClaveFecha(fechaSeleccionada);

    if (!calendarioExpandido) {
      weekStrip.innerHTML = "";
      const diaSemana = (fechaSeleccionada.getDay() + 6) % 7;
      const lunesSemana = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate() - diaSemana);

      for (let i = 0; i < 7; i++) {
        const d = new Date(lunesSemana.getFullYear(), lunesSemana.getMonth(), lunesSemana.getDate() + i);
        const claveD = formatearClaveFecha(d);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `week-pill ${claveD === claveHoy ? "is-today" : ""}`;
        btn.setAttribute("aria-pressed", String(claveD === claveSel));

        const tieneRegistro = diaTieneActividad(claveD);
        btn.innerHTML = `
          <small>${nombresDiaCorto[d.getDay()]}</small>
          <b>${d.getDate()}</b>
          ${tieneRegistro ? `<span class="has-record-dot" title="Con registros"></span>` : ""}
        `;

        btn.addEventListener("click", () => {
          fechaSeleccionada = d;
          mesVisible = new Date(d.getFullYear(), d.getMonth(), 1);
          renderizarCalendario();
          renderizarTodoElDia();
        });

        weekStrip.appendChild(btn);
      }
    } else {
      calDays.innerHTML = "";
      const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
      const totalDiasMes = new Date(anio, mes + 1, 0).getDate();

      for (let i = 0; i < primerDiaSemana; i++) {
        const vacio = document.createElement("div");
        vacio.className = "cal-day empty";
        vacio.setAttribute("aria-hidden", "true");
        calDays.appendChild(vacio);
      }

      for (let dia = 1; dia <= totalDiasMes; dia++) {
        const d = new Date(anio, mes, dia);
        const claveD = formatearClaveFecha(d);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `cal-day ${claveD === claveHoy ? "is-today" : ""}`;
        btn.setAttribute("aria-pressed", String(claveD === claveSel));

        const tieneRegistro = diaTieneActividad(claveD);
        btn.innerHTML = `
          <span>${dia}</span>
          ${tieneRegistro ? `<span class="has-record-dot"></span>` : ""}
        `;

        btn.addEventListener("click", () => {
          fechaSeleccionada = d;
          renderizarCalendario();
          renderizarTodoElDia();
        });

        calDays.appendChild(btn);
      }
    }
  }

  // --- 7.renderizado de medicamentos, bitacora  ---
  const listManana = document.getElementById("list-manana");
  const listMediodia = document.getElementById("list-mediodia");
  const listNoche = document.getElementById("list-noche");
  const listCaso = document.getElementById("list-caso");
  const countEl = document.getElementById("count");
  const fillEl = document.getElementById("fill");
  const fechaEl = document.getElementById("fecha-actual");
  const tituloHoyEl = document.getElementById("hoy");
  const bannerTemporal = document.getElementById("banner-temporal");

  function obtenerFranja(hora) {
    const h = parseInt(hora.split(":")[0], 10);
    if (h >= 5 && h < 12) return "manana";
    if (h >= 12 && h < 19) return "mediodia";
    return "noche";
  }

  function formatearCantidad(cant) {
    return cant === 0.5 ? "½" : cant;
  }

  function renderizarTodoElDia() {
    const estadoTemporal = obtenerEstadoTemporal(fechaSeleccionada);
    const claveFecha = formatearClaveFecha(fechaSeleccionada);
    const registroDia = historialDias[claveFecha] || { tomadas: {}, prn: {}, etiquetas: [], notaTurno: "" };

    const nombreDia = nombresDiaLargo[fechaSeleccionada.getDay()];
    const numDia = fechaSeleccionada.getDate();
    const nombreMes = nombresMes[fechaSeleccionada.getMonth()];
    const anio = fechaSeleccionada.getFullYear();
    fechaEl.textContent = `${nombreDia}, ${numDia} de ${nombreMes} de ${anio}`;

    if (estadoTemporal === "hoy") {
      tituloHoyEl.textContent = "Tomas de hoy";
      bannerTemporal.hidden = true;
    } else if (estadoTemporal === "pasado") {
      tituloHoyEl.textContent = `Historial del ${numDia} de ${nombreMes}`;
      bannerTemporal.hidden = false;
      bannerTemporal.className = "temporal-banner past";
      bannerTemporal.innerHTML = `<span>Estás viendo el historial registrado de una fecha anterior (solo lectura).</span>`;
    } else {
      tituloHoyEl.textContent = `Planificación para el ${numDia} de ${nombreMes}`;
      bannerTemporal.hidden = false;
      bannerTemporal.className = "temporal-banner future";
      bannerTemporal.innerHTML = `<span>Fecha futura: aún no ha llegado este día, por lo que no se pueden marcar tomas como completadas.</span>`;
    }

    listManana.innerHTML = "";
    listMediodia.innerHTML = "";
    listNoche.innerHTML = "";
    listCaso.innerHTML = "";

    const codigoDiaActual = mapaDiaAbreviado[fechaSeleccionada.getDay()];
    const puedeEditarMeds = (rolActual === "admin" || rolActual === "enfermero");
    const puedeMarcarTomas = (estadoTemporal === "hoy");

    let totalProgramadas = 0;
    let totalTomadas = 0;

    const delDia = medicamentos
      .filter(m => m.tipo === "caso" || (m.dias && m.dias.includes(codigoDiaActual)))
      .sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));

    delDia.forEach(med => {
      const li = document.createElement("li");

      if (med.tipo === "caso") {
        const tomasRegistradas = (registroDia.prn && registroDia.prn[med.id]) || 0;
        li.className = `dose prn ${puedeEditarMeds ? "can-edit" : ""}`;
        const notaTxt = med.nota ? ` · ${med.nota}` : "";

        let textoBotonPrn = "Registrar toma";
        if (estadoTemporal === "futuro") textoBotonPrn = "Día futuro";
        else if (estadoTemporal === "pasado") textoBotonPrn = `Registradas: ${tomasRegistradas}`;
        else if (tomasRegistradas >= med.max) textoBotonPrn = "Máximo alcanzado";

        const deshabilitado = !puedeMarcarTomas || tomasRegistradas >= med.max;

        li.innerHTML = `
          <div class="info">
            <strong>${med.nombre}</strong>
            <span>${formatearCantidad(med.cantidad)} ${med.unidad}${notaTxt}</span>
            <span class="meta">Registradas este día: ${tomasRegistradas} de ${med.max} máx.</span>
          </div>
          <button class="btn btn-prn" type="button" ${deshabilitado ? "disabled" : ""}>
            ${textoBotonPrn}
          </button>
          ${puedeEditarMeds ? `<button class="btn-del-med" type="button" title="Quitar medicamento">Quitar</button>` : ""}
        `;

        li.querySelector(".btn-prn").addEventListener("click", () => {
          if (!puedeMarcarTomas) return;
          const reg = obtenerRegistroDia(fechaSeleccionada);
          const actual = reg.prn[med.id] || 0;
          if (actual < med.max) {
            reg.prn[med.id] = actual + 1;
            guardarHistorial();
            renderizarCalendario();
            renderizarTodoElDia();
          }
        });

        if (puedeEditarMeds) {
          li.querySelector(".btn-del-med").addEventListener("click", () => eliminarMedicamento(med.id));
        }

        listCaso.appendChild(li);
      } else {
        totalProgramadas++;
        const horaTomada = registroDia.tomadas ? registroDia.tomadas[med.id] : null;
        const estaTomada = Boolean(horaTomada);
        if (estaTomada) totalTomadas++;

        li.className = `dose ${estaTomada ? "done" : ""} ${puedeEditarMeds ? "can-edit" : ""}`;
        const notaTxt = med.nota ? ` · ${med.nota}` : "";
        const selloTxt = estaTomada ? `<span class="taken-stamp">✓ Tomada a las ${horaTomada}</span>` : "";

        li.innerHTML = `
          <button class="check" type="button" aria-label="Marcar como tomada" ${!puedeMarcarTomas ? "disabled" : ""}></button>
          <time>${med.hora}</time>
          <div class="info">
            <strong>${med.nombre}</strong>
            <span>${formatearCantidad(med.cantidad)} ${med.unidad}${notaTxt}</span>
            ${selloTxt}
          </div>
          ${puedeEditarMeds ? `<button class="btn-del-med" type="button" title="Quitar medicamento">Quitar</button>` : ""}
        `;

        li.querySelector(".check").addEventListener("click", () => {
          if (!puedeMarcarTomas) return;
          const reg = obtenerRegistroDia(fechaSeleccionada);
          if (reg.tomadas[med.id]) {
            delete reg.tomadas[med.id];
          } else {
            const now = new Date();
            reg.tomadas[med.id] = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          }
          guardarHistorial();
          renderizarCalendario();
          renderizarTodoElDia();
        });

        if (puedeEditarMeds) {
          li.querySelector(".btn-del-med").addEventListener("click", () => eliminarMedicamento(med.id));
        }

        const franja = obtenerFranja(med.hora);
        if (franja === "manana") listManana.appendChild(li);
        else if (franja === "mediodia") listMediodia.appendChild(li);
        else listNoche.appendChild(li);
      }
    });

    countEl.textContent = `${totalTomadas} de ${totalProgramadas}`;
    const porcentaje = totalProgramadas > 0 ? (totalTomadas / totalProgramadas) * 100 : 0;
    fillEl.style.width = `${porcentaje}%`;

    renderizarBitacoraDia(registroDia, estadoTemporal);
  }

  // --- 8.notas del paciente---
  function renderizarBitacoraDia(registroDia, estadoTemporal) {
    const puedeEditarBitacora = (estadoTemporal === "hoy") && (rolActual === "admin" || rolActual === "enfermero");
    const etiquetasGuardadas = registroDia.etiquetas || [];
    const notaGuardada = registroDia.notaTurno || "";

    document.querySelectorAll(".estado-chip").forEach(chip => {
      const tag = chip.dataset.tag;
      chip.setAttribute("aria-pressed", String(etiquetasGuardadas.includes(tag)));
      chip.disabled = !puedeEditarBitacora;
    });

    const formWrap = document.getElementById("bitacora-form-wrap");
    const readonlyText = document.getElementById("bitacora-readonly-text");
    const textareaNota = document.getElementById("nota-turno");

    if (puedeEditarBitacora) {
      formWrap.hidden = false;
      readonlyText.hidden = true;
      textareaNota.value = notaGuardada;
    } else {
      formWrap.hidden = true;
      readonlyText.hidden = false;
      readonlyText.textContent = notaGuardada
        ? `Nota registrada: "${notaGuardada}"`
        : "Sin observaciones escritas en este día.";
    }
  }

  document.querySelectorAll(".estado-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (obtenerEstadoTemporal(fechaSeleccionada) !== "hoy") return;
      if (rolActual !== "admin" && rolActual !== "enfermero") return;

      const reg = obtenerRegistroDia(fechaSeleccionada);
      const tag = chip.dataset.tag;
      const idx = reg.etiquetas.indexOf(tag);
      if (idx === -1) reg.etiquetas.push(tag);
      else reg.etiquetas.splice(idx, 1);

      guardarHistorial();
      renderizarCalendario();
      renderizarTodoElDia();
    });
  });

  document.getElementById("btn-guardar-bitacora").addEventListener("click", () => {
    if (obtenerEstadoTemporal(fechaSeleccionada) !== "hoy") return;
    if (rolActual !== "admin" && rolActual !== "enfermero") return;

    const reg = obtenerRegistroDia(fechaSeleccionada);
    reg.notaTurno = document.getElementById("nota-turno").value.trim();
    guardarHistorial();
    renderizarCalendario();
    alert("Observaciones del turno guardadas correctamente.");
  });

  function eliminarMedicamento(id) {
    if (rolActual !== "admin" && rolActual !== "enfermero") return;
    medicamentos = medicamentos.filter(m => m.id !== id);
    guardarMeds();
    renderizarTodoElDia();
  }

  // --- 9.añadir medicamentos---
  let cantidadActual = 1;
  const cantOutput = document.getElementById("cant");

  document.getElementById("menos").addEventListener("click", () => {
    if (cantidadActual > 0.5) {
      cantidadActual = cantidadActual === 1 ? 0.5 : cantidadActual - 1;
      cantOutput.textContent = formatearCantidad(cantidadActual);
    }
  });

  document.getElementById("mas").addEventListener("click", () => {
    cantidadActual = cantidadActual === 0.5 ? 1 : cantidadActual + 1;
    cantOutput.textContent = formatearCantidad(cantidadActual);
  });

  const radiosModo = document.querySelectorAll('input[name="modo"]');
  const bloqueFijo = document.getElementById("m-fijo");
  const bloqueCada = document.getElementById("m-cada");
  const bloqueCaso = document.getElementById("m-caso");

  radiosModo.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      bloqueFijo.hidden = val !== "fijo";
      bloqueCada.hidden = val !== "cada";
      bloqueCaso.hidden = val !== "caso";
    });
  });

  document.getElementById("horas").addEventListener("click", (e) => {
    if (e.target.classList.contains("time-chip")) {
      const pressed = e.target.getAttribute("aria-pressed") === "true";
      e.target.setAttribute("aria-pressed", String(!pressed));
    }
  });

  document.getElementById("addh").addEventListener("click", () => {
    const nuevaHora = prompt("Introduce la hora en formato HH:MM (ej. 14:30):", "14:00");
    if (nuevaHora && /^([01]\d|2[0-3]):([0-5]\d)$/.test(nuevaHora)) {
      const chip = document.createElement("button");
      chip.className = "chip time-chip";
      chip.type = "button";
      chip.setAttribute("aria-pressed", "true");
      chip.textContent = nuevaHora;
      document.getElementById("horas").insertBefore(chip, document.getElementById("addh"));
    } else if (nuevaHora !== null) {
      alert("Formato de hora inválido. Usa HH:MM (ejemplo: 09:30).");
    }
  });

  document.querySelectorAll("#dias-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!pressed));
    });
  });

  document.getElementById("btn-guardar").addEventListener("click", () => {
    if (rolActual !== "admin" && rolActual !== "enfermero") return;

    const nombre = document.getElementById("nom").value.trim();
    if (!nombre) {
      alert("Por favor, escribe el nombre del medicamento.");
      return;
    }

    const unidad = document.getElementById("uni").value;
    const nota = document.getElementById("nota").value.trim();
    const modo = document.querySelector('input[name="modo"]:checked').value;

    if (modo === "fijo") {
      const horasActivas = Array.from(document.querySelectorAll("#horas .time-chip[aria-pressed='true']")).map(c => c.textContent);
      const diasActivos = Array.from(document.querySelectorAll("#dias-chips .chip[aria-pressed='true']")).map(c => c.textContent);

      if (horasActivas.length === 0 || diasActivos.length === 0) {
        alert("Selecciona al menos una hora y un día.");
        return;
      }

      horasActivas.forEach(hora => {
        medicamentos.push({
          id: Date.now() + Math.random(),
          nombre,
          cantidad: cantidadActual,
          unidad,
          hora,
          nota,
          tipo: "fijo",
          dias: diasActivos
        });
      });
    } else if (modo === "cada") {
      const intervalo = parseInt(document.getElementById("cada").value, 10);
      const horaInicio = document.getElementById("ini").value || "08:00";
      let [h, m] = horaInicio.split(":").map(Number);

      for (let actual = h; actual < 24; actual += intervalo) {
        const horaFormateada = `${String(actual).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        medicamentos.push({
          id: Date.now() + Math.random(),
          nombre,
          cantidad: cantidadActual,
          unidad,
          hora: horaFormateada,
          nota: nota || `Cada ${intervalo}h`,
          tipo: "fijo",
          dias: ["L", "M", "X", "J", "V", "S", "D"]
        });
      }
    } else if (modo === "caso") {
      const situacion = document.getElementById("situ").value.trim();
      const max = parseInt(document.getElementById("max").value, 10);
      medicamentos.push({
        id: Date.now() + Math.random(),
        nombre,
        cantidad: cantidadActual,
        unidad,
        nota: situacion || nota,
        tipo: "caso",
        max
      });
    }

    guardarMeds();
    limpiarFormulario();
    renderizarTodoElDia();
  });

  function limpiarFormulario() {
    document.getElementById("nom").value = "";
    document.getElementById("nota").value = "";
    document.getElementById("situ").value = "";
    cantidadActual = 1;
    cantOutput.textContent = "1";
  }

  document.getElementById("btn-cancelar").addEventListener("click", limpiarFormulario);

  // --- 10. MODAL RESUMEN DEL DÍA Y RELEVO ---
  const modalResumen = document.getElementById("modal-resumen");
  const resumenTexto = document.getElementById("resumen-texto");
  const resumenSubtitulo = document.getElementById("resumen-subtitulo");

  document.getElementById("btn-historial").addEventListener("click", () => {
    const clave = formatearClaveFecha(fechaSeleccionada);
    const reg = historialDias[clave] || { tomadas: {}, prn: {}, etiquetas: [], notaTurno: "" };
    const codigoDia = mapaDiaAbreviado[fechaSeleccionada.getDay()];

    const fijosDelDia = medicamentos
      .filter(m => m.tipo === "fijo" && m.dias && m.dias.includes(codigoDia))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    const tomadas = [];
    const pendientes = [];

    fijosDelDia.forEach(m => {
      if (reg.tomadas && reg.tomadas[m.id]) {
        tomadas.push(`✓ ${m.hora} - ${m.nombre} (tomada a las ${reg.tomadas[m.id]})`);
      } else {
        pendientes.push(`○ ${m.hora} - ${m.nombre}`);
      }
    });

    const prnUsados = medicamentos
      .filter(m => m.tipo === "caso" && reg.prn && reg.prn[m.id] > 0)
      .map(m => `• ${m.nombre}: ${reg.prn[m.id]} toma(s)`);

    const etiquetasStr = (reg.etiquetas && reg.etiquetas.length > 0) ? reg.etiquetas.join(", ") : "Sin etiquetas";
    const notaStr = reg.notaTurno ? reg.notaTurno : "Sin observaciones";
    const avisosStr = avisos.length > 0 ? avisos.map(a => `! ${a.texto}`).join("\n") : "Ninguno";
    const pacienteHeader = adminConfig.pacienteNombre ? `Paciente: ${adminConfig.pacienteNombre}\n` : "";

    resumenSubtitulo.textContent = `${nombresDiaLargo[fechaSeleccionada.getDay()]}, ${fechaSeleccionada.getDate()} de ${nombresMes[fechaSeleccionada.getMonth()]} de ${fechaSeleccionada.getFullYear()}`;

    resumenTexto.textContent =
      `RESUMEN DEL PASTILLERO (${nombresRol[rolActual] || "Consulta"})\n` +
      pacienteHeader +
      `Fecha: ${resumenSubtitulo.textContent}\n\n` +
      `TOMAS COMPLETADAS:\n${tomadas.length ? tomadas.join("\n") : "Ninguna registrada"}\n\n` +
      `TOMAS PENDIENTES / NO REGISTRADAS:\n${pendientes.length ? pendientes.join("\n") : "Ninguna"}\n\n` +
      `MEDICACIÓN OCASIONAL (SI HUBO SÍNTOMAS):\n${prnUsados.length ? prnUsados.join("\n") : "No fue necesaria"}\n\n` +
      `ESTADO DEL PACIENTE:\n${etiquetasStr}\nObservaciones: ${notaStr}\n\n` +
      `AVISOS ACTIVOS:\n${avisosStr}`;

    modalResumen.hidden = false;
  });

  document.getElementById("btn-cerrar-resumen").addEventListener("click", () => {
    modalResumen.hidden = true;
  });

  document.getElementById("btn-copiar-resumen").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(resumenTexto.textContent);
      alert("Resumen copiado al portapapeles. Ya puedes pegarlo en WhatsApp y mandarlo a tu bro.");
    } catch {
      alert("No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.");
    }
  });

  //inicializar
  inicializarVistaPorRol();
  renderizarFichaPaciente();
  renderizarCalendario();
  renderizarAvisos();
  renderizarTodoElDia();
});