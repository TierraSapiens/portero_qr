const SUPABASE_URL = 'https://onkvblpxdoziwfdcsuxm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VnqeSIIwxchGOSbDi6y4-Q_g0SRbXBP';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Lógica Principal: Se ejecuta apenas se abre la web
document.addEventListener('DOMContentLoaded', async () => {
    const parametros = new URLSearchParams(window.location.search);
    // Probamos por defecto con tu edificio, o usamos 'edificio-sol' si no lo encuentra
    const idEdificio = parametros.get('edificio') || 'edificio-gala I'; 

    await cargarEdificio(idEdificio);
});

async function cargarEdificio(idEdificio) {
    const nombreEl = document.getElementById('nombre-edificio');
    const direccionEl = document.getElementById('direccion-edificio');
    const grillaEl = document.getElementById('grilla-departamentos');

    try {
        // A. Buscamos los datos del edificio en Supabase usando nuestra nueva variable clienteSupabase
        const { data: edificio, error: errorEdificio } = await clienteSupabase
            .from('edificios')
            .select('*')
            .eq('id', idEdificio)
            .single();

        if (errorEdificio || !edificio) {
            nombreEl.innerText = "Edificio no encontrado";
            direccionEl.innerText = `No se encontró en Supabase el ID: "${idEdificio}"`;
            return;
        }

        // B. Mostramos el nombre y dirección en la pantalla
        nombreEl.innerText = edificio.nombre;
        direccionEl.innerText = edificio.direccion;

        // C. Buscamos todos los departamentos de este edificio
        const { data: departamentos, error: errorDeptos } = await clienteSupabase
            .from('departamentos')
            .select('*')
            .eq('id_edificio', idEdificio);

        if (errorDeptos) {
            grillaEl.innerHTML = `<p class="col-span-3 text-center text-red-400">Error al cargar unidades</p>`;
            return;
        }

        // CORRECCIÓN: Ordenamiento "Natural" inteligente en JavaScript
        departamentos.sort((a, b) => {
            // Compara los pisos como números reales (1, 2... 9, 10)
            const comparaciónPiso = a.piso.localeCompare(b.piso, undefined, { numeric: true });
            if (comparaciónPiso !== 0) return comparaciónPiso;
            // Si están en el mismo piso, ordena por letra (A, B, C...)
            return a.letra.localeCompare(b.letra);
        });

        // D. DIBUJAMOS LOS BOTONES DINÁMICAMENTE
        grillaEl.innerHTML = ''; // Limpiamos el texto de carga
        
        departamentos.forEach(depto => {
            const boton = document.createElement('button');
            boton.className = "bg-slate-700 hover:bg-blue-600 text-white font-medium py-3 px-2 rounded-xl border border-slate-600 transition-all duration-200 shadow hover:shadow-blue-500/30 flex flex-col items-center justify-center group cursor-pointer";
            
            boton.innerHTML = `
                <span class="text-xs text-slate-400 group-hover:text-blue-200">PISO ${depto.piso}</span>
                <span class="text-lg font-bold">${depto.letra}</span>
            `;

            // Acción temporal para probar el botón
            boton.onclick = () => {
                alert(`Llamando al departamento: Piso ${depto.piso} - Depto ${depto.letra}\n(¡En el siguiente paso conectaremos el timbre!)`);
            };

            grillaEl.appendChild(boton);
        });
    } catch (error) {
        console.error("Error general:", error);
        nombreEl.innerText = "Error de conexión";
        direccionEl.innerText = "Presiona F12 para ver la consola del navegador";
    }
}