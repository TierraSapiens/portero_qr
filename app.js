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

// 3. TIMBRE ELECTRÓNICO (Ahora con Botones Interactivos para el Vecino)
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

        // B. Configuración de los Botones de Respuesta Rápida (Teclado Interactivo)
        const botonesRespuesta = {
            inline_keyboard: [
                [
                    { text: "🏃‍♂️ ¡Ya bajo!", callback_data: `resp_bajo_${piso}_${letra}` },
                    { text: "⏳ Esperá 5 min", callback_data: `resp_espera_${piso}_${letra}` }
                ],
                [
                    { text: "📦 Dejalo en el hall", callback_data: `resp_hall_${piso}_${letra}` },
                    { text: "❌ No estoy en casa", callback_data: `resp_noestoy_${piso}_${letra}` }
                ]
            ]
        };

        // C. Enviamos la alerta con el teclado adjunto a Telegram
        for (const residente of residentes) {
            if (!residente.telegram_chat_id) continue;

            const mensaje = `🔔 *¡DING DONG!*\nEstán tocando el timbre en el portero para el *Piso ${piso} - ${letra}*.\n\n👤 *Motivo / Dice ser:* ${identificacion}\n\n👇 *Elige una respuesta rápida para la pantalla de la puerta:*`;
            const urlTelegram = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            
            await fetch(urlTelegram, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: residente.telegram_chat_id,
                    text: mensaje,
                    parse_mode: 'Markdown',
                    reply_markup: botonesRespuesta // <- ¡ACÁ ESTÁ LA MAGIA!
                })
            });
        }

    } catch (err) {
        console.error("Error al procesar el timbre:", err);
    }
}

// =================================================================
// 4. LÓGICA DEL ESCUDO DE IDENTIFICACIÓN Y RADAR DE RESPUESTA (v1.04)
// =================================================================

let idDeptoTemporal = null;
let pisoTemporal = null;
let letraTemporal = null;
let motivoSeleccionado = "";
let intervaloRadar = null; // Variable para controlar el radar

// Abre el modal cuando tocan un departamento en la botonera
function abrirModalIdentificacion(id, piso, letra) {
    idDeptoTemporal = id;
    pisoTemporal = piso;
    letraTemporal = letra;
    motivoSeleccionado = "";
    
    // Si había un radar viejo encendido, lo apagamos
    if (intervaloRadar) clearInterval(intervaloRadar);
    
    // Reseteamos la vista para mostrar el Formulario (y ocultar la Espera)
    document.getElementById('seccion-formulario').classList.remove('hidden');
    document.getElementById('seccion-espera').classList.add('hidden');
    document.getElementById('mensaje-respuesta-vecino').classList.add('hidden');
    document.getElementById('icono-espera').className = "animate-spin text-5xl mb-4 inline-block";
    document.getElementById('icono-espera').innerText = "⌛";
    document.getElementById('texto-estado-espera').innerText = "Aguarda en la puerta, por favor. El vecino está leyendo tu llamado en su celular.";
    
    document.getElementById('modal-titulo').innerText = `Llamando a Piso ${piso} - ${letra}`;
    document.getElementById('modal-subtitulo').innerText = "Por seguridad, indícale al vecino quién eres";
    document.getElementById('input-mensaje').value = '';
    resetearEstilosBotones();
    
    document.getElementById('modal-identificacion').classList.remove('hidden');
}

function cerrarModal() {
    if (intervaloRadar) clearInterval(intervaloRadar); // Apagamos el radar si cierran
    document.getElementById('modal-identificacion').classList.add('hidden');
}

function seleccionarMotivo(motivo, botonClickeado) {
    motivoSeleccionado = motivo;
    resetearEstilosBotones();
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

// El Filtro Anti-Bromas: Pasa a la Pantalla de Espera y enciende el Radar
function confirmarTimbre() {
    const textoEscrito = document.getElementById('input-mensaje').value.trim();
    
    if (!motivoSeleccionado && !textoEscrito) {
        alert("⚠️ Por favor, selecciona una opción o escribe un mensaje para poder llamar.");
        return;
    }
    
    let identificacionFinal = motivoSeleccionado;
    if (textoEscrito) {
        identificacionFinal = motivoSeleccionado ? `${motivoSeleccionado} - "${textoEscrito}"` : `💬 "${textoEscrito}"`;
    }
    
    // 1. CAMBIAMOS LA VISTA: Ocultamos formulario y mostramos Pantalla de Espera en la PC
    document.getElementById('seccion-formulario').classList.add('hidden');
    document.getElementById('seccion-espera').classList.remove('hidden');
    document.getElementById('espera-piso-letra').innerText = `${pisoTemporal} - ${letraTemporal}`;
    document.getElementById('modal-subtitulo').innerText = "Conectando en tiempo real con Telegram...";
    
    // 2. Disparamos el timbre hacia tu celular
    tocarTimbre(idDeptoTemporal, pisoTemporal, letraTemporal, identificacionFinal);
    
    // 3. ¡ENCENDEMOS EL RADAR PARA ESCUCHAR TU RESPUESTA!
    iniciarRadarDeRespuestas(pisoTemporal, letraTemporal);
}

// =================================================================
// 📡 EL RADAR: Consulta a Telegram cada 2.5s si el vecino tocó un botón
// =================================================================
function iniciarRadarDeRespuestas(piso, letra) {
    let intentos = 0;
    const cajaRespuesta = document.getElementById('mensaje-respuesta-vecino');
    
    intervaloRadar = setInterval(async () => {
        intentos++;
        // Si pasan 60 segundos (24 intentos) y nadie atiende, cortamos la espera
        if (intentos > 24) {
            clearInterval(intervaloRadar);
            document.getElementById('icono-espera').className = "text-5xl mb-4 inline-block";
            document.getElementById('icono-espera').innerText = "😶";
            cajaRespuesta.innerHTML = "⚠️ No hubo respuesta rápida. Puedes intentar llamar nuevamente o llamar por teléfono.";
            cajaRespuesta.className = "block bg-amber-600/30 border border-amber-500 text-amber-200 p-4 rounded-xl font-bold text-sm mb-6";
            return;
        }

        try {
            // Le preguntamos a los servidores de Telegram: "¿Hay algún clic nuevo en los botones?"
            const urlUpdates = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
            const res = await fetch(urlUpdates);
            const data = await res.json();

            if (data.ok && data.result.length > 0) {
                // Revisamos los eventos desde el más reciente al más viejo
                for (let i = data.result.length - 1; i >= 0; i--) {
                    const item = data.result[i];
                    
                    // ¿Es un clic de botón (callback_query) y es para nuestro piso y letra?
                    if (item.callback_query && item.callback_query.data.includes(`_${piso}_${letra}`)) {
                        const codigoRespuesta = item.callback_query.data;
                        const idQuery = item.callback_query.id;

                        // 1. LE DECIMOS A TELEGRAM "¡RECIBIDO!" PARA QUE DEJE DE GIRAR EL RELOJITO EN TU CELULAR
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                callback_query_id: idQuery,
                                text: "¡Aviso enviado a la pantalla del edificio! ✅"
                            })
                        });

                        // 2. Apagamos el radar porque ya nos respondieron
                        clearInterval(intervaloRadar);

                        // 3. ACTUALIZAMOS LA PANTALLA DE LA PC/NOTEBOOK CON LA RESPUESTA
                        document.getElementById('icono-espera').className = "text-5xl mb-4 inline-block animate-bounce";
                        document.getElementById('icono-espera').innerText = "🔔";
                        document.getElementById('texto-estado-espera').innerText = "¡El vecino ha respondido a tu llamado!";

                        let textoMostrar = "";
                        let estiloCaja = "block p-5 rounded-xl font-extrabold text-xl mb-6 shadow-xl animate-pulse ";

                        if (codigoRespuesta.includes("resp_bajo")) {
                            textoMostrar = "🏃‍♂️ ¡YA BAJO!\nEl vecino va en camino a abrirte.";
                            estiloCaja += "bg-green-600 text-white border-2 border-green-400";
                        } else if (codigoRespuesta.includes("resp_espera")) {
                            textoMostrar = "⏳ ESPERÁ 5 MINUTOS\nPor favor aguarda un momento en la puerta.";
                            estiloCaja += "bg-blue-600 text-white border-2 border-blue-400";
                        } else if (codigoRespuesta.includes("resp_hall")) {
                            textoMostrar = "📦 DÉJALO EN EL HALL / ASCENSOR\nMuchas gracias por tu entrega.";
                            estiloCaja += "bg-amber-600 text-white border-2 border-amber-300";
                        } else if (codigoRespuesta.includes("resp_noestoy")) {
                            textoMostrar = "❌ NO ESTOY EN CASA\nEn este momento no hay nadie para atenderte.";
                            estiloCaja += "bg-red-600 text-white border-2 border-red-400";
                        }

                        cajaRespuesta.innerHTML = textoMostrar;
                        cajaRespuesta.className = estiloCaja;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("Error en el radar de Telegram:", error);
        }
    }, 2500); // Consulta a Telegram cada 2.5 segundos
}