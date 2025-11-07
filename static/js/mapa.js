// mapa.js (versión corregida)
const mapa = L.map('mapa').setView([-15.8240876317, -70.0085868406], 17);

// ===============================
// 🌍 Capas base
// ===============================
const capaUrbana = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
});
const capaSatelital = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});
const capaTopografica = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png');

// capa activa por defecto
let capaActiva = capaUrbana;
capaActiva.addTo(mapa);

// 🔹 Grupo para las casas (persiste aunque cambies de capa base)
// Declararlo una sola vez
let capaCasas = L.layerGroup().addTo(mapa);

// ===============================
// 🔄 Botones para cambiar vista
// ===============================
document.getElementById('btnUrbano').addEventListener('click', () => {
    if (capaActiva !== capaUrbana) {
        mapa.removeLayer(capaActiva);
        capaUrbana.addTo(mapa);
        capaActiva = capaUrbana;
    }
});

document.getElementById('btnSatelital').addEventListener('click', () => {
    if (capaActiva !== capaSatelital) {
        mapa.removeLayer(capaActiva);
        capaSatelital.addTo(mapa);
        capaActiva = capaSatelital;
    }
});

document.getElementById('btnTopografico').addEventListener('click', () => {
    if (capaActiva !== capaTopografica) {
        mapa.removeLayer(capaActiva);
        capaTopografica.addTo(mapa);
        capaActiva = capaTopografica;
    }
});

// ===============================
// Modal y formulario (sin cambios lógicos)
// ===============================
const modal = document.getElementById("modalCasa");
const form = document.getElementById("formCasa");
const cancelar = document.getElementById("cancelar");

let latActual, lngActual;

// Click en el mapa para abrir modal
mapa.on('click', (e) => {
    latActual = e.latlng.lat;
    lngActual = e.latlng.lng;
    modal.style.display = "block";
});

// Cancelar
cancelar.onclick = () => {
    modal.style.display = "none";
};

// Guardar nueva casa (ahora añade el marcador al grupo capaCasas)
form.onsubmit = (e) => {
    e.preventDefault();

    const direccion = {
        calle: document.getElementById("direccion").value,
        barrio: "Centro",
        distrito: "Puno"
    };

    const pagos = [];
    const anios = [2020, 2021, 2022, 2023, 2024, 2025];
    anios.forEach(anio => {
        pagos.push({
            anio: anio,
            pagado: document.getElementById("pago" + anio).checked,
            monto: parseFloat(document.getElementById("impuesto_anual").value)
        });
    });

    const nuevaCasa = {
        direccion,
        latitud: latActual,
        longitud: lngActual,
        propietario: document.getElementById("propietario").value,
        valor_catastral: parseFloat(document.getElementById("valor_catastral").value),
        impuesto_anual: parseFloat(document.getElementById("impuesto_anual").value),
        pagos
    };

    fetch('/agregar_casa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaCasa)
    })
        .then(res => res.json())
        .then(data => {
            // Backend genera id y nombre
            nuevaCasa.id = data.id;
            nuevaCasa.nombre = `casa ${data.id}`;

            // Añadir marcador al grupo (no directamente al mapa)
            const marcador = L.marker([latActual, lngActual])
                .bindPopup(`<b>${nuevaCasa.nombre}</b><br>${direccion.calle}`);
            capaCasas.addLayer(marcador);

            modal.style.display = "none";
            form.reset();
        })
        .catch(err => console.error("Error al guardar:", err));
};

// Cerrar modal
document.querySelector(".modal .close").onclick = () => {
    modal.style.display = "none";
    form.reset();
};
window.onclick = (event) => {
    if (event.target == modal) modal.style.display = "none";
};

// ===============================
// 🔹 Función para cargar casas desde backend y añadirlas a capaCasas
// ===============================
async function cargarCasas() {
    try {
        const resp = await fetch('/casas');
        const casas = await resp.json();

        capaCasas.clearLayers(); // Limpia marcadores anteriores

        casas.forEach(casa => {
            const lat = casa.latitud;
            const lon = casa.longitud;
            const direccion = casa.direccion?.calle || "Sin calle";
            const numero = casa.direccion?.numero ? ` #${casa.direccion.numero}` : "";
            const barrio = casa.direccion?.barrio ? `<br><b>Barrio:</b> ${casa.direccion.barrio}` : "";
            const distrito = casa.direccion?.distrito ? `<br><b>Distrito:</b> ${casa.direccion.distrito}` : "";

            // Pagos realizados
            const pagos = casa.pagos?.map(p =>
                `<li>${p.anio}: ${p.pagado ? "✅" : "❌"} (${p.monto})</li>`
            ).join("") || "No hay datos";

            const popup = `
                <b>${casa.nombre}</b><br>
                <b>Propietario:</b> ${casa.propietario}<br>
                <b>Dirección:</b> ${direccion}${numero}${barrio}${distrito}<br>
                <b>Valor catastral:</b> ${casa.valor_catastral}<br>
                <b>Impuesto anual:</b> ${casa.impuesto_anual}<br>
                <b>Pagos:</b><ul>${pagos}</ul>
            `;

            const marcador = L.marker([lat, lon]).bindPopup(popup);
            capaCasas.addLayer(marcador);
        });

        console.log(`✅ Se cargaron ${casas.length} casas.`);
    } catch (error) {
        console.error("Error al cargar casas:", error);
    }
}

// Conectar botón (asegúrate que en tu HTML el id sea exactamente 'btn-mostrar-todas')
const btnMostrarCasas = document.getElementById("btnMostrarCasas");
let modoColor = false; // false = marcadores normales, true = colores según deuda

if (btnMostrarCasas) {
    btnMostrarCasas.addEventListener("click", async () => {
        try {
            const resp = await fetch('/casas');
            const casas = await resp.json();
            capaCasas.clearLayers();

            casas.forEach(casa => {
                const lat = casa.latitud;
                const lon = casa.longitud;
                const direccion = casa.direccion?.calle || "Sin calle";
                const nombre = casa.nombre || "Casa sin nombre";
                const propietario = casa.propietario || "Sin propietario";

                let icono;

                if (!modoColor) {
                    // 🟢 Modo 1: marcador normal
                    icono = L.icon({
                        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    });
                } else {
                    // 🎨 Modo 2: colores según deuda
                    const totalPagos = casa.pagos?.length || 0;
                    const pagosHechos = casa.pagos?.filter(p => p.pagado).length || 0;
                    const ratio = pagosHechos / totalPagos;

                    let color;
                    if (ratio === 1) color = "#007bff"; // Azul (todo pagado)
                    else if (ratio >= 0.8) color = "#6f42c1"; // Morado
                    else if (ratio >= 0.6) color = "#9b59b6"; // Violeta
                    else if (ratio >= 0.4) color = "#ff8c00"; // Naranja
                    else if (ratio >= 0.2) color = "#ff6600"; // Naranja oscuro
                    else color = "#ff0000"; // Rojo

                    icono = L.divIcon({
                        className: "custom-icon",
                        html: `<div style="
                            width:20px;
                            height:20px;
                            border-radius:50%;
                            background:${color};
                            border:2px solid white;
                            box-shadow:0 0 5px rgba(0,0,0,0.5);
                        "></div>`
                    });
                }

                const numero = casa.direccion?.numero ? ` #${casa.direccion.numero}` : "";
                const barrio = casa.direccion?.barrio ? `<br><b>Barrio:</b> ${casa.direccion.barrio}` : "";
                const distrito = casa.direccion?.distrito ? `<br><b>Distrito:</b> ${casa.direccion.distrito}` : "";

                const pagos = casa.pagos?.map(p =>
                    `<li>${p.anio}: ${p.pagado ? "✅" : "❌"} (${p.monto})</li>`
                ).join("") || "No hay datos";

                const popup = `
    <b>${nombre}</b><br>
    <b>Propietario:</b> ${propietario}<br>
    <b>Dirección:</b> ${direccion}${numero}${barrio}${distrito}<br>
    <b>Valor catastral:</b> ${casa.valor_catastral}<br>
    <b>Impuesto anual:</b> ${casa.impuesto_anual}<br>
    <b>Pagos:</b><ul>${pagos}</ul>
`;


                L.marker([lat, lon], { icon: icono }).bindPopup(popup).addTo(capaCasas);
            });

            modoColor = !modoColor; // alternar modo
            console.log(`🔁 Modo cambiado: ${modoColor ? "Colores por deuda" : "Marcadores normales"}`);
        } catch (error) {
            console.error("Error al mostrar casas:", error);
        }
    });
}
// Llamar al cargar la página para poblar los marcadores (opcional)
cargarCasas();
// ===============================
// 🔹 Ocultar todas las casas
// ===============================
const btnOcultar = document.getElementById("btnOcultarCasas");
if (btnOcultar) {
    btnOcultar.addEventListener("click", () => {
        capaCasas.clearLayers();
        console.log("🏠 Todas las casas han sido ocultadas.");
    });
} else {
    console.warn("Botón 'btnOcultarCasas' no encontrado en el DOM.");
}
// 🔹 Botón para mostrar solo las casas con deudas
// 🔹 Botón para mostrar solo las casas con deudas
const btnMostrarDeuda = document.getElementById("btnMostrarDeuda");
if (btnMostrarDeuda) {
    btnMostrarDeuda.addEventListener("click", async () => {
        try {
            const resp = await fetch('/casas');
            const casas = await resp.json();

            capaCasas.clearLayers(); // limpia marcadores anteriores

            // Filtrar casas con al menos un pago pendiente
            const casasConDeuda = casas.filter(casa =>
                casa.pagos?.some(p => !p.pagado)
            );

            casasConDeuda.forEach(casa => {
                const lat = casa.latitud;
                const lon = casa.longitud;
                const direccion = casa.direccion?.calle || "Sin calle";

                const totalPagos = casa.pagos?.length || 0;
                const pagosHechos = casa.pagos?.filter(p => p.pagado).length || 0;

                // Escala de colores (sin azul, solo de morado a rojo)
                let color;
                switch (pagosHechos) {
                    case 4:
                        color = "#6f42c1"; // Morado
                        break;
                    case 3:
                        color = "#9b59b6"; // Violeta
                        break;
                    case 2:
                        color = "#ff8c00"; // Naranja
                        break;
                    case 1:
                        color = "#ff6600"; // Naranja oscuro
                        break;
                    default:
                        color = "#ff0000"; // Rojo (0/5)
                }

                const icono = L.divIcon({
                    className: "custom-icon",
                    html: `<div style="
                        width:20px;
                        height:20px;
                        border-radius:50%;
                        background:${color};
                        border:2px solid white;
                        box-shadow:0 0 5px rgba(0,0,0,0.5);
                    "></div>`
                });

                const numero = casa.direccion?.numero ? ` #${casa.direccion.numero}` : "";
                const barrio = casa.direccion?.barrio ? `<br><b>Barrio:</b> ${casa.direccion.barrio}` : "";
                const distrito = casa.direccion?.distrito ? `<br><b>Distrito:</b> ${casa.direccion.distrito}` : "";

                const pagos = casa.pagos?.map(p =>
                    `<li>${p.anio}: ${p.pagado ? "✅ Pagado" : "❌ Pendiente"} (${p.monto})</li>`
                ).join("") || "No hay datos";

                const popup = `
    <b>${casa.nombre}</b><br>
    <b>Propietario:</b> ${casa.propietario}<br>
    <b>Dirección:</b> ${casa.direccion?.calle || "-"}${numero}${barrio}${distrito}<br>
    <b>Valor catastral:</b> ${casa.valor_catastral}<br>
    <b>Impuesto anual:</b> ${casa.impuesto_anual}<br>
    <b>Pagos:</b><ul>${pagos}</ul>
`;

                L.marker([lat, lon], { icon: icono })
                    .bindPopup(popup)
                    .addTo(capaCasas);
            });

            console.log(`💰 Se mostraron ${casasConDeuda.length} casas con deuda.`);
        } catch (error) {
            console.error("Error al mostrar casas con deudas:", error);
        }
    });
}
// 🔹 Botón para mostrar solo las casas con pagos completos
const btnMostrarPago = document.getElementById("btnMostrarPago");
if (btnMostrarPago) {
    btnMostrarPago.addEventListener("click", async () => {
        try {
            const resp = await fetch('/casas');
            const casas = await resp.json();

            capaCasas.clearLayers(); // limpia los marcadores anteriores

            // Filtrar casas que tienen todos los pagos hechos
            const casasPagadas = casas.filter(casa =>
                casa.pagos?.every(p => p.pagado)
            );

            casasPagadas.forEach(casa => {
                const lat = casa.latitud;
                const lon = casa.longitud;
                const direccion = casa.direccion?.calle || "Sin calle";

                // 🔵 Color azul (pagos completos)
                const color = "#007bff";

                const icono = L.divIcon({
                    className: "custom-icon",
                    html: `<div style="
                        width:20px;
                        height:20px;
                        border-radius:50%;
                        background:${color};
                        border:2px solid white;
                        box-shadow:0 0 5px rgba(0,0,0,0.5);
                    "></div>`
                });

                const numero = casa.direccion?.numero ? ` #${casa.direccion.numero}` : "";
                const barrio = casa.direccion?.barrio ? `<br><b>Barrio:</b> ${casa.direccion.barrio}` : "";
                const distrito = casa.direccion?.distrito ? `<br><b>Distrito:</b> ${casa.direccion.distrito}` : "";

                const pagos = casa.pagos?.map(p =>
                    `<li>${p.anio}: ${p.pagado ? "✅ Pagado" : "❌ Pendiente"} (${p.monto})</li>`
                ).join("") || "No hay datos";

                const popup = `
    <b>${casa.nombre}</b><br>
    <b>Propietario:</b> ${casa.propietario}<br>
    <b>Dirección:</b> ${casa.direccion?.calle || "-"}${numero}${barrio}${distrito}<br>
    <b>Valor catastral:</b> ${casa.valor_catastral}<br>
    <b>Impuesto anual:</b> ${casa.impuesto_anual}<br>
    <b>Pagos:</b><ul>${pagos}</ul>
`;

                L.marker([lat, lon], { icon: icono })
                    .bindPopup(popup)
                    .addTo(capaCasas);
            });

            console.log(`✅ Se mostraron ${casasPagadas.length} casas con pagos completos.`);
        } catch (error) {
            console.error("Error al mostrar casas con pagos completos:", error);
        }
    });
}

const btnBuscar = document.getElementById("btnBuscar");

if (btnBuscar) {
    btnBuscar.addEventListener("click", async () => {
        const direccion = document.getElementById("txtBuscarDireccion")?.value.trim() || "";
        const numero = document.getElementById("txtBuscarNumero")?.value.trim() || "";
        const coords = document.getElementById("txtBuscarCoords")?.value.trim() || "";

        // ⚠️ Si no hay ningún dato ingresado, avisamos
        if (!direccion && !numero && !coords) {
            alert("Por favor ingresa al menos un dato para buscar (número, dirección o coordenadas).");
            return;
        }

        try {
            const resp = await fetch("/buscar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ direccion, numero, coords })
            });

            if (!resp.ok) {
                throw new Error(`Error HTTP ${resp.status}`);
            }

            const data = await resp.json();

            // Si el backend devuelve directamente una lista
            const casas = data.resultados || data || [];

            if (!Array.isArray(casas) || casas.length === 0) {
                alert("❌ No se encontraron casas con esos datos.");
                return;
            }

            capaCasas.clearLayers();

            let mensaje = `✅ Se encontraron ${casas.length} casa(s):\n\n`;

            casas.forEach((casa, i) => {
                const dir = casa.direccion || {};
                const pagos = (casa.pagos || [])
                    .map(p => `${p.anio}: ${p.pagado ? "✔️ Pagado" : "❌ Pendiente"} (${p.monto})`)
                    .join("\n") || "Sin datos";

                mensaje += `
🏠 Casa ${i + 1}
• ID: ${casa.id ?? "-"}
• Nombre: ${casa.nombre ?? "-"}
• Propietario: ${casa.propietario ?? "-"}
• Dirección: ${dir.calle ?? "-"}, ${dir.numero ?? "-"}, ${dir.barrio ?? "-"}, ${dir.distrito ?? "-"}
• Valor catastral: ${casa.valor_catastral ?? "-"}
• Impuesto anual: ${casa.impuesto_anual ?? "-"}
• Coordenadas: (${casa.latitud}, ${casa.longitud})
• Pagos:
${pagos}
--------------------------\n`;

                // Agregamos marcador en el mapa
                const marcador = L.marker([casa.latitud, casa.longitud])
                    .bindPopup(`<b>${casa.nombre || "Casa"}</b><br>${dir.calle || "-"}, ${dir.numero || ""}`);
                capaCasas.addLayer(marcador);
            });

            alert(mensaje);

        } catch (error) {
            console.error("Error en la búsqueda:", error);
            alert("⚠️ Error al buscar casas.");
        }
    });
}
// ===============================
// 📊 ESTADÍSTICAS
// ===============================
// --- ESTADÍSTICAS ---
const btnEstadisticas = document.getElementById("btnEstadisticas");
const estadisticasPanel = document.getElementById("estadisticasPanel");
const mapaDiv = document.getElementById("mapa");

btnEstadisticas.addEventListener("click", async () => {
    mapaDiv.style.display = "none";
    estadisticasPanel.style.display = "block";
    generarEstadisticas();
});

async function generarEstadisticas() {
    const resp = await fetch("/casas");
    const casas = await resp.json();

    const total = casas.length;
    const pagadas = casas.filter(c => {
        if (!Array.isArray(c.pagos)) return false;
        return c.pagos.every(p => p.pagado === true); // o usa .every si quieres que tenga todos los años al día
    }).length;

    const noPagadas = total - pagadas;

    // Actualiza indicadores
    document.getElementById("totalCasas").textContent = total;
    document.getElementById("casasPagadas").textContent = pagadas;
    document.getElementById("casasNoPagadas").textContent = noPagadas;

    // --- Gráfico de pastel ---
    // --- Gráfico de pastel con gradiente ---
    // --- Gráfico de pastel con gradiente por cantidad de pagos ---
    const niveles = [0, 1, 2, 3, 4, 5];
    const colores = {
        0: "#ff0000",  // Rojo (0 pagos)
        1: "#ff6600",  // Naranja oscuro
        2: "#ff8c00",  // Naranja
        3: "#9b59b6",  // Violeta
        4: "#6f42c1",  // Morado
        5: "#007bff"   // Azul (todo pagado)
    };

    const conteo = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    casas.forEach(c => {
        if (!Array.isArray(c.pagos)) return;
        const pagosHechos = c.pagos.filter(p => p.pagado === true).length;
        conteo[pagosHechos]++;
    });

    const labels = niveles.map(n => `${n} pagos`);
    const data = niveles.map(n => conteo[n]);
    const bgColors = niveles.map(n => colores[n]);

    const ctxPizza = document.getElementById("graficoPizza");
    new Chart(ctxPizza, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: {
                    display: true,
                    text: 'Distribución de pagos por casa (0–5 años)'
                }
            }
        }
    });




    // --- Gráfico de barras ---
    const porCalle = {};
    casas.forEach(c => {
        const calle = c.direccion?.calle || "Sin calle";
        if (!porCalle[calle]) porCalle[calle] = { pagadas: 0, noPagadas: 0 };
        const estaPagada = Array.isArray(c.pagos) && c.pagos.some(p => p.pagado === true);
        if (estaPagada) porCalle[calle].pagadas++;
        else porCalle[calle].noPagadas++;
    });

    const calles = Object.keys(porCalle);
    const pagadasCalle = calles.map(c => porCalle[c].pagadas);
    const noPagadasCalle = calles.map(c => porCalle[c].noPagadas);

    const ctxBarras = document.getElementById("graficoBarras");
    new Chart(ctxBarras, {
        type: 'bar',
        data: {
            labels: calles,
            datasets: [
                { label: 'Pagaron', data: pagadasCalle, backgroundColor: '#4CAF50' },
                { label: 'No pagaron', data: noPagadasCalle, backgroundColor: '#F44336' }
            ]
        },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: '#333' } }, y: { beginAtZero: true } }
        }
    });
}

// --- GENERAR PDF ---
document.getElementById("btnPDF").addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    pdf.setFontSize(16);
    pdf.text("Reporte de Estadísticas de Pagos", 20, 20);

    pdf.setFontSize(12);
    pdf.text(`Fecha: ${new Date().toLocaleString()}`, 20, 30);
    pdf.text(`Total de casas: ${document.getElementById("totalCasas").textContent}`, 20, 40);
    pdf.text(`Pagaron: ${document.getElementById("casasPagadas").textContent}`, 20, 50);
    pdf.text(`Pendientes: ${document.getElementById("casasNoPagadas").textContent}`, 20, 60);

    // --- Convertir los canvas a imágenes ---
    const pizzaCanvas = document.getElementById("graficoPizza");
    const barrasCanvas = document.getElementById("graficoBarras");

    const pizzaImg = pizzaCanvas.toDataURL("image/png", 1.0);
    const barrasImg = barrasCanvas.toDataURL("image/png", 1.0);

    // --- Añadir imágenes al PDF ---
    pdf.addImage(pizzaImg, "PNG", 20, 70, 160, 90); // x, y, width, height
    pdf.addImage(barrasImg, "PNG", 20, 170, 160, 90);

    pdf.save("reporte_estadisticas.pdf");
});
const btnVolver = document.getElementById("btnVolver");

const btnVolverMapa = document.getElementById("btnVolverMapa");
btnVolverMapa.addEventListener("click", () => {
    estadisticasPanel.style.display = "none";
    mapaDiv.style.display = "block";
});

document.getElementById("btnBuscarCercanas").addEventListener("click", async () => {
    const numeroCasa = document.getElementById("txtCasaReferencia").value.trim();
    const radio = parseFloat(document.getElementById("txtRadioKD").value);

    if (!numeroCasa || isNaN(radio)) {
        alert("Ingrese número de casa y radio válidos.");
        return;
    }

    try {
        // Llamada al backend
        const resp = await fetch("/buscar_cercanas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numero: numeroCasa, radio })
        });

        const data = await resp.json();

        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        const casas = data.resultados;
        if (!casas || casas.length === 0) {
            alert("No se encontraron casas cercanas.");
            return;
        }

        // Limpiar marcadores anteriores de búsqueda
        if (window.marcadoresKD) {
            window.marcadoresKD.forEach(m => mapa.removeLayer(m));
        }
        window.marcadoresKD = [];

        let mensaje = "";

        casas.forEach((casa, i) => {
            const dir = casa.direccion || {};
            const pagos = (casa.pagos || [])
                .map(p => `${p.anio}: ${p.pagado ? "✔️ Pagado" : "❌ Pendiente"} (${p.monto})`)
                .join("<br>") || "Sin datos";

            mensaje += `
🏠 Casa ${i + 1}
• ID: ${casa.id ?? "-"}
• Nombre: ${casa.nombre ?? "-"}
• Propietario: ${casa.propietario ?? "-"}
• Dirección: ${dir.calle ?? "-"}, ${dir.numero ?? "-"}, ${dir.barrio ?? "-"}, ${dir.distrito ?? "-"}
• Valor catastral: ${casa.valor_catastral ?? "-"}
• Impuesto anual: ${casa.impuesto_anual ?? "-"}
• Coordenadas: (${casa.latitud}, ${casa.longitud})
• Pagos:
${pagos}
--------------------------\n`;

            // Crear popup más detallado
            const popup = `
                <b>${casa.nombre || "Casa"}</b><br>
                <b>Propietario:</b> ${casa.propietario || "-"}<br>
                <b>Dirección:</b> ${dir.calle || "-"} ${dir.numero || ""}<br>
                <b>Barrio:</b> ${dir.barrio || "-"}<br>
                <b>Distrito:</b> ${dir.distrito || "-"}<br>
                <b>Valor catastral:</b> ${casa.valor_catastral || "-"}<br>
                <b>Impuesto anual:</b> ${casa.impuesto_anual || "-"}<br>
                <b>Pagos:</b><br>${pagos}
            `;

            const marcador = L.marker([casa.latitud, casa.longitud])
                .bindPopup(popup);

            capaCasas.addLayer(marcador);
            window.marcadoresKD.push(marcador);
        });

        // Centrar mapa en el grupo de resultados
        const bounds = casas.map(c => [c.latitud, c.longitud]);
        mapa.fitBounds(bounds, { padding: [50, 50] });

        console.log("✅ Casas cercanas encontradas:", mensaje);
    } catch (err) {
        console.error("Error al buscar casas cercanas:", err);
        alert("Ocurrió un error al buscar casas cercanas.");
    }
});

// ===============================
// 🔹 Modal para agregar casa manualmente por coordenadas
// ===============================
const modalCoords = document.getElementById("modalCasaCoords");
const formCoords = document.getElementById("formCasaCoords");
const cancelarCoords = document.getElementById("cancelarCoords");

// Abrir modal al hacer click en el botón "Agregar por coordenadas"
document.getElementById("btnAgregarCoords").addEventListener("click", () => {
    modalCoords.style.display = "block";
});

// Cancelar
cancelarCoords.onclick = () => {
    modalCoords.style.display = "none";
    formCoords.reset();
};

// Guardar casa manual con coordenadas
formCoords.onsubmit = (e) => {
    e.preventDefault();

    const lat = parseFloat(document.getElementById("latitudCoords").value);
    const lng = parseFloat(document.getElementById("longitudCoords").value);

    if (isNaN(lat) || isNaN(lng)) {
        alert("Ingrese coordenadas válidas.");
        return;
    }

    const direccion = {
        calle: document.getElementById("direccionCoords").value,
        barrio: "Centro",
        distrito: "Puno"
    };

    const pagos = [];
    const anios = [2020, 2021, 2022, 2023, 2024, 2025];
    anios.forEach(anio => {
        pagos.push({
            anio: anio,
            pagado: document.getElementById("pago" + anio + "Coords").checked,
            monto: parseFloat(document.getElementById("impuesto_anualCoords").value)
        });
    });

    const nuevaCasa = {
        direccion,
        latitud: lat,
        longitud: lng,
        propietario: document.getElementById("propietarioCoords").value,
        valor_catastral: parseFloat(document.getElementById("valor_catastralCoords").value),
        impuesto_anual: parseFloat(document.getElementById("impuesto_anualCoords").value),
        pagos
    };

    // Guardar en backend
    fetch('/agregar_casa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaCasa)
    })
        .then(res => res.json())
        .then(data => {
            nuevaCasa.id = data.id;
            nuevaCasa.nombre = `casa ${data.id}`;

            const popup = `
                <b>${nuevaCasa.nombre}</b><br>
                <b>Propietario:</b> ${nuevaCasa.propietario}<br>
                <b>Dirección:</b> ${direccion.calle} ${document.getElementById("numeroCoords").value}<br>
                <b>Valor catastral:</b> ${nuevaCasa.valor_catastral}<br>
                <b>Impuesto anual:</b> ${nuevaCasa.impuesto_anual}<br>
                <b>Pagos:</b><ul>${pagos.map(p => `<li>${p.anio}: ${p.pagado ? "✅" : "❌"} (${p.monto})</li>`).join("")}</ul>
            `;

            const marcador = L.marker([lat, lng]).bindPopup(popup);
            capaCasas.addLayer(marcador);

            modalCoords.style.display = "none";
            formCoords.reset();
        })
        .catch(err => console.error("Error al guardar la casa:", err));
};

// Cerrar modal al hacer click en la "x"
modalCoords.querySelector(".close").onclick = () => {
    modalCoords.style.display = "none";
    formCoords.reset();
};

// Cerrar modal al hacer click fuera de la ventana
window.addEventListener("click", (event) => {
    if (event.target === modalCoords) {
        modalCoords.style.display = "none";
        formCoords.reset();
    }
});
const modalEditar = document.getElementById("modalEditarCasa");
const formEditar = document.getElementById("formEditarCasa");
const cerrarEditar = document.querySelector(".closeEditar");
const cancelarEditar = document.getElementById("cancelarEditar");
const btnBuscarCasa = document.getElementById("btnBuscarCasa");
const pagosContainer = document.getElementById("pagosContainer");
const btnEliminarCasa = document.getElementById("eliminarCasa");

// Array de casas limpio
let casas = []; // variable global

// Función para cargar las casas desde el servidor
async function cargarCasas() {
    try {
        const response = await fetch('/casas');
        if (!response.ok) throw new Error("Error al cargar casas");

        casas = await response.json();
        console.log("Casas cargadas:", casas);

        // Aquí puedes llamar a la función que dibuja los marcadores
        dibujarCasasEnMapa();
    } catch (err) {
        console.error("❌ Error al obtener casas:", err);
    }
}

// Llamar al cargar la página
cargarCasas();

let casaActual = null;

// Abrir modal
document.getElementById("btnEditarCasa").addEventListener("click", () => {
    modalEditar.style.display = "block";
    formEditar.style.display = "none";
});

// Cerrar modal
cerrarEditar.onclick = cancelarEditar.onclick = () => {
    modalEditar.style.display = "none";
    casaActual = null;
};

// ===== BUSCAR CASA =====
// ===== BUSCAR CASA =====
btnBuscarCasa.addEventListener("click", () => {
    const busquedaPropietario = document.getElementById("buscarPropietario").value.trim().toLowerCase();
    const busquedaIdInput = document.getElementById("buscarId").value.trim();
    const busquedaId = busquedaIdInput !== "" ? parseInt(busquedaIdInput, 10) : NaN;

    if (!busquedaPropietario && isNaN(busquedaId)) {
        alert("Ingresa un propietario o un número de casa para buscar.");
        return;
    }

    casaActual = casas.find(c => {
        const matchPropietario = busquedaPropietario && c.propietario?.toLowerCase().trim() === busquedaPropietario;
        const matchId = !isNaN(busquedaId) && c.id === busquedaId;
        return matchPropietario || matchId; // 
    });

    if (!casaActual) {
        alert("Casa no encontrada");
        return;
    }

    // Llenar formulario con los datos de casaActual...
    document.getElementById("nombre").value = casaActual.nombre;
    document.getElementById("calle").value = casaActual.direccion.calle;
    document.getElementById("numero").value = casaActual.direccion.numero;
    document.getElementById("barrio").value = casaActual.direccion.barrio;
    document.getElementById("distrito").value = casaActual.direccion.distrito;
    document.getElementById("latitud").value = casaActual.latitud;
    document.getElementById("longitud").value = casaActual.longitud;
    document.getElementById("propietario").value = casaActual.propietario;
    document.getElementById("valor_catastral").value = casaActual.valor_catastral;
    document.getElementById("impuesto_anual").value = casaActual.impuesto_anual;

    // Llenar pagos
    pagosContainer.innerHTML = "<h4>Pagos</h4>";
    casaActual.pagos.forEach((pago, index) => {
        pagosContainer.innerHTML += `
            <div>
                Año: ${pago.anio} 
                Pagado: <input type="checkbox" data-index="${index}" ${pago.pagado ? "checked" : ""}>
                Monto: <input type="number" value="${pago.monto}" data-index="${index}" class="montoPago">
            </div>
        `;
    });

    formEditar.style.display = "block";
});


// -----------------------------
// Guardar cambios del modal Editar
// -----------------------------
formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!casaActual) {
        alert("No hay casa seleccionada para editar.");
        return;
    }

    // Obtener valores del formulario
    const nombre = document.getElementById("nombre").value.trim();
    const calle = document.getElementById("calle").value.trim();
    const numero = document.getElementById("numero").value.trim();
    const barrio = document.getElementById("barrio").value.trim();
    const distrito = document.getElementById("distrito").value.trim();
    const latitud = parseFloat(document.getElementById("latitud").value);
    const longitud = parseFloat(document.getElementById("longitud").value);
    const propietario = document.getElementById("propietario").value.trim();
    const valor_catastral = parseFloat(document.getElementById("valor_catastral").value);
    const impuesto_anual = parseFloat(document.getElementById("impuesto_anual").value);

    // Reconstruir pagos a partir del container (mantener orden según casaActual.pagos)
    let pagosActualizados = [];
    // Si tenemos casaActual.pagos como referencia de años, úsala para preservar años
    const pagosReferencia = Array.isArray(casaActual.pagos) ? casaActual.pagos : [];

    // Buscar checkboxes y montos por data-index
    const checkboxes = pagosContainer.querySelectorAll('input[type="checkbox"][data-index]');
    const montos = pagosContainer.querySelectorAll('input.montoPago[data-index]');

    // Mapear por índice (data-index)
    const mapping = {};
    checkboxes.forEach(cb => {
        const idx = cb.getAttribute('data-index');
        mapping[idx] = mapping[idx] || {};
        mapping[idx].pagado = cb.checked;
    });
    montos.forEach(m => {
        const idx = m.getAttribute('data-index');
        mapping[idx] = mapping[idx] || {};
        mapping[idx].monto = parseFloat(m.value) || 0;
    });

    // Construir array de pagos en el mismo orden que referencia (si existe)
    if (pagosReferencia.length > 0) {
        pagosReferencia.forEach((pago, idx) => {
            const mm = mapping[idx] || {};
            pagosActualizados.push({
                anio: pago.anio,
                pagado: typeof mm.pagado === 'boolean' ? mm.pagado : !!pago.pagado,
                monto: typeof mm.monto === 'number' ? mm.monto : (pago.monto || 0)
            });
        });
    } else {
        // Si no hay referencia, intentar construir desde mapping ordenado por index
        const idxs = Object.keys(mapping).sort((a,b) => parseInt(a)-parseInt(b));
        idxs.forEach(i => {
            const mm = mapping[i];
            pagosActualizados.push({
                anio: null,
                pagado: !!mm.pagado,
                monto: mm.monto || 0
            });
        });
    }

    const payload = {
        id: casaActual.id,
        nombre,
        direccion: {
            calle,
            numero: numero === "" ? null : numero,
            barrio,
            distrito
        },
        latitud,
        longitud,
        propietario,
        valor_catastral: isNaN(valor_catastral) ? 0 : valor_catastral,
        impuesto_anual: isNaN(impuesto_anual) ? 0 : impuesto_anual,
        pagos: pagosActualizados
    };

    try {
        const resp = await fetch('/editar_casa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok || data.error) {
            throw new Error(data.error || `HTTP ${resp.status}`);
        }

        // Actualizar array local 'casas' si existe
        if (Array.isArray(casas)) {
            const idx = casas.findIndex(c => c.id === casaActual.id);
            if (idx !== -1) {
                casas[idx] = { ...casas[idx], ...payload };
            }
        }

        // Refrescar marcadores / recargar casas
        await cargarCasas();

        alert("✅ Casa actualizada correctamente.");
        modalEditar.style.display = "none";
        casaActual = null;
    } catch (err) {
        console.error("Error al editar la casa:", err);
        alert("❌ Error al guardar cambios: " + err.message);
    }
});

// -----------------------------
// Eliminar casa desde el modal
// -----------------------------
btnEliminarCasa.addEventListener('click', async () => {
    if (!casaActual) {
        alert("No hay casa seleccionada para eliminar.");
        return;
    }

    if (!confirm(`¿Eliminar la casa ${casaActual.nombre || casaActual.id}? Esta acción no se puede deshacer.`)) return;

    try {
        const resp = await fetch('/eliminar_casa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: casaActual.id })
        });

        const data = await resp.json();
        if (!resp.ok || data.error) {
            throw new Error(data.error || `HTTP ${resp.status}`);
        }

        // Actualizar array local y UI
        if (Array.isArray(casas)) {
            casas = casas.filter(c => c.id !== casaActual.id);
        }
        await cargarCasas();

        alert("🗑️ Casa eliminada.");
        modalEditar.style.display = "none";
        casaActual = null;
    } catch (err) {
        console.error("Error al eliminar:", err);
        alert("❌ Error al eliminar la casa: " + err.message);
    }
});
