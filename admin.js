const SUPABASE_URL = 'https://onkvblpxdoziwfdcsuxm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VnqeSIIwxchGOSbDi6y4-Q_g0SRbXBP';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPABASE_URL = 'https://onkvblpxdoziwfdcsuxm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VnqeSIIwxchGOSbDi6y4-Q_g0SRbXBP';
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔑 CONFIGURACIÓN DE TU CONTRASEÑA (Cámbiala por la que desees)
const CLAVE_SECRETA_CONSORCIO = "Gala2026"; 

let idEdificioActual = 'edificio-gala I';
let listaDepartamentos = [];

// Evento Inicializador con control de seguridad
document.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get('edificio')) {
        idEdificioActual = parametros.get('edificio');
    }

    // Revisamos si el administrador ya puso la clave correctamente en esta sesión
    if (sessionStorage.getItem('admin_autenticado') === 'true') {
        // Si ya estaba autenticado, ocultamos el candado y cargamos el panel
        document.getElementById('pantalla-bloqueo').classList.add('hidden');
        cargarTodo();
    } else {
        // Si no, dejamos la pantalla de bloqueo activa y escuchamos el botón "Enter" en el teclado
        document.getElementById('input-password-admin').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') intentarAcceso();
        });
    }
});

// Función que valida la contraseña escrita
function intentarAcceso() {
    const claveEscrita = document.getElementById('input-password-admin').value;
    const errorEl = document.getElementById('error-password');

    if (claveEscrita === CLAVE_SECRETA_CONSORCIO) {
        // Guardamos en la memoria temporal del navegador que ya se autenticó con éxito
        sessionStorage.setItem('admin_autenticado', 'true');
        
        // Hacemos desaparecer la pantalla de bloqueo con estilo
        document.getElementById('pantalla-bloqueo').classList.add('hidden');
        
        // Cargamos los datos de Supabase
        cargarTodo();
    } else {
        // Mostramos el cartel rojo de error
        errorEl.classList.remove('hidden');
        document.getElementById('input-password-admin').value = '';
        document.getElementById('input-password-admin').focus();
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get('edificio')) {
        idEdificioActual = parametros.get('edificio');
    }
    cargarTodo();
});

async function cargarTodo() {
    await cargarDatosEdificio();
    await cargarDepartamentos();
    await cargarResidentes();
    generarCartelQR();
}

// 1. CARGAR DATOS DEL EDIFICIO
async function cargarDatosEdificio() {
    const { data: edificio, error } = await clienteSupabase
        .from('edificios')
        .select('*')
        .eq('id', idEdificioActual)
        .single();

    if (error || !edificio) return;

    document.getElementById('admin-nombre-edificio').innerText = edificio.nombre;
    document.getElementById('admin-direccion-edificio').innerText = edificio.direccion;
    document.getElementById('print-nombre-edificio').innerText = edificio.nombre;
    document.getElementById('print-direccion-edificio').innerText = edificio.direccion;
}

// 2. CARGAR DEPARTAMENTOS AL DESPLEGABLE
async function cargarDepartamentos() {
    const { data: departamentos, error } = await clienteSupabase
        .from('departamentos')
        .select('*')
        .eq('id_edificio', idEdificioActual);

    if (error) return;

    // Ordenamiento natural matemático
    departamentos.sort((a, b) => {
        const compPiso = a.piso.localeCompare(b.piso, undefined, { numeric: true });
        if (compPiso !== 0) return compPiso;
        return a.letra.localeCompare(b.letra);
    });

    listaDepartamentos = departamentos;
    const selectDepto = document.getElementById('select-depto');
    selectDepto.innerHTML = '<option value="">-- Selecciona un Departamento --</option>';

    departamentos.forEach(depto => {
        const option = document.createElement('option');
        option.value = depto.id;
        option.innerText = `Piso ${depto.piso} - Depto "${depto.letra}"`;
        selectDepto.appendChild(option);
    });
}

// 3. CARGAR TABLA DE RESIDENTES
async function cargarResidentes() {
    const tablaEl = document.getElementById('tabla-residentes');
    
    // Obtenemos los residentes del edificio
    const { data: residentes, error } = await clienteSupabase
        .from('residentes')
        .select('*');

    if (error || !residentes) {
        tablaEl.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-400">Error al cargar datos</td></tr>';
        return;
    }

    // Filtramos solo los residentes que pertenezcan a los departamentos del edificio actual
    const idsDeptosEdificio = listaDepartamentos.map(d => d.id);
    const residentesEdificio = residentes.filter(r => idsDeptosEdificio.includes(r.id_departamento));

    if (residentesEdificio.length === 0) {
        tablaEl.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">Aún no hay residentes vinculados en este edificio.</td></tr>';
        return;
    }

    tablaEl.innerHTML = '';

    residentesEdificio.forEach(res => {
        // Buscamos los datos de piso y letra de ese residente
        const depto = listaDepartamentos.find(d => d.id === res.id_departamento);
        const etiquetaDepto = depto ? `Piso ${depto.piso} - ${depto.letra}` : 'Desc.';

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-800/40 transition";
        fila.innerHTML = `
            <td class="py-3 font-bold text-blue-400">${etiquetaDepto}</td>
            <td class="py-3 font-medium text-white">${res.nombre_residente || 'Sin nombre'}</td>
            <td class="py-3 text-slate-400 font-mono text-xs">${res.telegram_chat_id || 'No asignado'}</td>
            <td class="py-3 text-right">
                <button onclick="eliminarResidente('${res.id}', '${res.nombre_residente}')" 
                        class="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                    🗑️ Eliminar
                </button>
            </td>
        `;
        tablaEl.appendChild(fila);
    });
}

// 4. GUARDAR / VINCULAR NUEVO RESIDENTE
async function guardarResidente(event) {
    event.preventDefault(); // Evita que se recargue la página de golpe
    
    const idDepartamento = document.getElementById('select-depto').value;
    const nombre = document.getElementById('input-nombre').value.trim();
    const chatId = document.getElementById('input-chatid').value.trim();

    if (!idDepartamento || !nombre || !chatId) {
        alert("⚠️ Por favor completa los 3 campos.");
        return;
    }

    const { error } = await clienteSupabase
        .from('residentes')
        .insert([
            {
                id_departamento: idDepartamento,
                nombre_residente: nombre,
                telegram_chat_id: chatId
            }
        ]);

    if (error) {
        alert("❌ Error al guardar en Supabase: " + error.message);
        console.error(error);
        return;
    }

    alert(`✅ ¡Listo! "${nombre}" fue vinculado correctamente.`);
    document.getElementById('form-nuevo-residente').reset();
    cargarResidentes(); // Actualizamos la tabla
}

// 5. ELIMINAR RESIDENTE
async function eliminarResidente(idResidente, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar a "${nombre}" del sistema? Ya no recibirá alertas del timbre.`)) {
        return;
    }

    const { error } = await clienteSupabase
        .from('residentes')
        .delete()
        .eq('id', idResidente);

    if (error) {
        alert("❌ Error al eliminar: " + error.message);
        return;
    }

    cargarResidentes(); // Actualizamos la tabla
}

// 6. GENERAR CARTEL Y QR DEL EDIFICIO EN ALTA DEFINICIÓN
function generarCartelQR() {
    // Calculamos la URL real donde estaría el portero (en local o en Vercel)
    const urlBase = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
    const urlPortero = `${urlBase}?edificio=${encodeURIComponent(idEdificioActual)}`;
    
    // Usamos una API gratuita y veloz para generar la imagen QR sin instalar librerías pesadas
    const urlImagenQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlPortero)}&margin=10`;
    
    document.getElementById('img-qr-edificio').src = urlImagenQR;
}