const SUPABASE_URL = 'https://onkvblpxdoziwfdcsuxm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VnqeSIIwxchGOSbDi6y4-Q_g0SRbXBP';
const TELEGRAM_BOT_TOKEN = '8718568145:AAHV9tXSaKFD4arN5goj5v0gff3SE4c99VA';

const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    const parametros = new URLSearchParams(window.location.search);
    const idEdificio = parametros.get('edificio') || 'edificio-gala I'; 

    await cargarEdificio(idEdificio);
});

async function cargarEdificio(idEdificio) {
    const nombreEl = document.getElementById('nombre-edificio');
    const direccionEl = document.getElementById('direccion-edificio');
    const grillaEl = document.getElementById('grilla-departamentos');

    try {
        const { data: edificio, error: errorEdificio } = await clienteSupabase
            .from('edificios')
            .select('*')
            .eq('id', idEdificio)
            .single();

        if (errorEdificio || !edificio) {
            nombreEl.innerText = "Edificio no encontrado";
            return;
        }

        nombreEl.innerText = edificio.nombre;
        direccionEl.innerText = edificio.direccion;

        const { data: departamentos, error: errorDeptos } = await clienteSupabase
            .from('departamentos')
            .select('*')
            .eq('id_edificio', idEdificio);

        if (errorDeptos) {
            grillaEl.innerHTML = `<p class="text-center text-red-400">Error al cargar unidades</p>`;
            return;
        }

        // ORDENAMIENTO NATURAL PERFECTO
        departamentos.sort((a, b) => {
            const comparaciónPiso = a.piso.localeCompare(b.piso, undefined, { numeric: true });
            if (comparaciónPiso !== 0) return comparaciónPiso;
            return a.letra.localeCompare(b.letra);
        });

        grillaEl.innerHTML = '';
        
        departamentos.forEach(depto => {
            const boton = document.createElement('button');
            boton.className = "bg-slate-700 hover:bg-blue-600 text-white font-medium py-3 px-2 rounded-xl border border-slate-600 transition-all duration-200 shadow hover:shadow-blue-500/30 flex flex-col items-center justify-center group cursor-pointer";
            
            boton.innerHTML = `
                <span class="text-xs text-slate-400 group-hover:text-blue-200">PISO ${depto.piso}</span>
                <span class="text-lg font-bold">${depto.letra}</span>
            `;

            // CAMBIO CLAVE: Al hacer clic, ahora abrimos el Escudo en lugar de tocar directo
            boton.onclick = () => abrirModalIdentificacion(depto.id, depto.piso, depto.letra);

            grillaEl.appendChild(boton);
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

// 3. TIMBRE ELECTRÓNICO (Ahora recibe quién es el visitante)
async function tocarTimbre(idDepartamento, piso, letra, identificacion = "Visita no identificada") {
    // A. Feedback visual rápido para la visita
    alert(`🔔 Enviando aviso a Piso ${piso} - ${letra}...\nPor favor, aguarda un momento en la puerta.`);
    
    try {
        const { data: residentes, error } = await clienteSupabase
            .from('residentes')
            .select('telegram_chat_id, nombre_residente')
            .eq('id_departamento', idDepartamento);

        if (error || !residentes || residentes.length === 0) {
            console.warn(`Departamento sin residentes configurados: ${idDepartamento}`);
            return;
        }

        // B. Enviamos la alerta enriquecida a Telegram
        for (const residente of residentes) {
            if (!residente.telegram_chat_id) continue;

            // Agregamos la identificación al mensaje de Telegram
            const mensaje = `🔔 *¡DING DONG!*\nEstán tocando el timbre en el portero para el *Piso ${piso} - ${letra}*.\n\n👤 *Motivo / Dice ser:* ${identificacion}`;
            const urlTelegram = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            
            await fetch(urlTelegram, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: residente.telegram_chat_id,
                    text: mensaje,
                    parse_mode: 'Markdown'
                })
            });
        }

    } catch (err) {
        console.error("Error al procesar el timbre:", err);
    }
}

// =================================================================
// 4. LÓGICA DEL ESCUDO DE IDENTIFICACIÓN (Paso 1 - v1.04)
// =================================================================

// Variables para recordar qué departamento eligió el visitante
let idDeptoTemporal = null;
let pisoTemporal = null;
let letraTemporal = null;
let motivoSeleccionado = "";

// Abre el modal cuando tocan un departamento en la botonera
function abrirModalIdentificacion(id, piso, letra) {
    idDeptoTemporal = id;
    pisoTemporal = piso;
    letraTemporal = letra;
    motivoSeleccionado = ""; // Reiniciamos el motivo
    
    // Actualizamos el título del modal
    document.getElementById('modal-titulo').innerText = `Llamando a Piso ${piso} - ${letra}`;
    
    // Limpiamos los campos y estilos del intento anterior
    document.getElementById('input-mensaje').value = '';
    resetearEstilosBotones();
    
    // Mostramos la ventana emergente
    document.getElementById('modal-identificacion').classList.remove('hidden');
}

// Cierra el modal si se arrepienten o cierran con la X
function cerrarModal() {
    document.getElementById('modal-identificacion').classList.add('hidden');
}

// Resalta el botón rápido que clickeó el usuario
function seleccionarMotivo(motivo, botonClickeado) {
    motivoSeleccionado = motivo;
    resetearEstilosBotones();
    
    // Resaltamos el botón elegido en color azul
    botonClickeado.classList.remove('bg-slate-800', 'border-slate-700');
    botonClickeado.classList.add('bg-blue-600/30', 'border-blue-500', 'text-blue-300', 'font-bold');
}

function resetearEstilosBotones() {
    const botones = document.querySelectorAll('.motivo-btn');
    botones.forEach(btn => {
        btn.classList.add('bg-slate-800', 'border-slate-700');
        btn.classList.remove('bg-blue-600/30', 'border-blue-500', 'text-blue-300', 'font-bold');
    });
}

// El Filtro Anti-Bromas: Verifica que se hayan identificado antes de llamar
function confirmarTimbre() {
    const textoEscrito = document.getElementById('input-mensaje').value.trim();
    
    // VALIDACIÓN: Si no eligió un botón rápido Y tampoco escribió nada, bloqueamos
    if (!motivoSeleccionado && !textoEscrito) {
        alert("⚠️ Por favor, selecciona una opción (Ej: Delivery) o escribe un mensaje para poder llamar.");
        return;
    }
    
    // Armamos el texto de identificación final
    let identificacionFinal = motivoSeleccionado;
    if (textoEscrito) {
        identificacionFinal = motivoSeleccionado ? `${motivoSeleccionado} - "${textoEscrito}"` : `💬 "${textoEscrito}"`;
    }
    
    // Cerramos el modal
    cerrarModal();
    
    // ¡Disparamos el timbre real pasándole quién está en la puerta!
    tocarTimbre(idDeptoTemporal, pisoTemporal, letraTemporal, identificacionFinal);
}