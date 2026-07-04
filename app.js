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

        // ORDENAMIENTO
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

            // AL HACER CLIC: Llamamos a la nueva función del timbre
            boton.onclick = () => tocarTimbre(depto.id, depto.piso, depto.letra);

            grillaEl.appendChild(boton);
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

// 3. TIMBRE ELECTRONICO
async function tocarTimbre(idDepartamento, piso, letra) {
    // A. Feedback visual rápido para la visita
    alert(`🔔 Tocando timbre en Piso ${piso} - ${letra}...\nPor favor, aguarda un momento.`);
    
    try {
        const { data: residentes, error } = await clienteSupabase
            .from('residentes')
            .select('telegram_chat_id, nombre_residente')
            .eq('id_departamento', idDepartamento);

        if (error || !residentes || residentes.length === 0) {
            console.warn(`Departamento sin residentes configurados: ${idDepartamento}`);
            return;
        }

        // B.alerta silenciosamente en segundo plano
        for (const residente of residentes) {
            if (!residente.telegram_chat_id) continue;

            const mensaje = `🔔 *¡DING DONG!*\nEstán tocando el timbre desde el Portero QR para el departamento *Piso ${piso} - ${letra}*.`;
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