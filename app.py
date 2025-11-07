from flask import Flask, render_template, request, jsonify
import json
import os
import math

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'casas_predial.json')

# =====================
# Funciones de datos
# =====================
def cargar_datos():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            print("Cargando datos:")
            return json.load(f)
    return []

def guardar_datos(data):
    print("Guardando datos:")
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def obtener_casas():
    casas = cargar_datos()
    return jsonify(casas)

# =====================
# KD-Tree
# =====================
kd_tree = None
coordenadas = []

def reconstruir_kdtree():
    """
    Reconstruye el KD-Tree propio usando las coordenadas de las casas.
    """
    global kd_tree, coordenadas
    casas = cargar_datos()
    coordenadas = [(c.get("latitud", 0), c.get("longitud", 0)) for c in casas]
    if coordenadas:
        kd_tree = KDTree2D(coordenadas)  # usa el KD-Tree propio
    else:
        kd_tree = None
# -----------------------------
# KD-Tree 2D propio
# -----------------------------
class KDNode2D:
    def __init__(self, point, index, axis, left=None, right=None):
        self.point = point    # (lat, lon)
        self.index = index    # índice en la lista original
        self.axis = axis      # 0=lat, 1=lon
        self.left = left
        self.right = right

class KDTree2D:
    def __init__(self, points):
        # points: lista de tuples (lat, lon)
        self.points = points
        self.root = self.build(list(enumerate(points)), depth=0)

    def build(self, points_with_index, depth):
        if not points_with_index:
            return None

        axis = depth % 2
        points_with_index.sort(key=lambda x: x[1][axis])
        median = len(points_with_index) // 2

        index, point = points_with_index[median]
        left = self.build(points_with_index[:median], depth + 1)
        right = self.build(points_with_index[median+1:], depth + 1)

        return KDNode2D(point, index, axis, left, right)

    # Buscar todos los puntos dentro de radio r
    def query_ball_point(self, target, r):
        result = []
        r2 = r * r  # comparamos distancias al cuadrado
        self._search(self.root, target, r2, result)
        return result

    def _search(self, node, target, r2, result):
        if node is None:
            return

        # distancia al cuadrado
        d2 = (node.point[0] - target[0])**2 + (node.point[1] - target[1])**2
        if d2 <= r2:
            result.append(node.index)

        axis = node.axis
        diff = target[axis] - node.point[axis]

        # Buscar rama cercana primero
        if diff <= 0:
            self._search(node.left, target, r2, result)
        else:
            self._search(node.right, target, r2, result)

        # Revisar la rama opuesta si puede haber puntos dentro del radio
        if diff**2 <= r2:
            if diff <= 0:
                self._search(node.right, target, r2, result)
            else:
                self._search(node.left, target, r2, result)
# =====================
# Rutas Flask
# =====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/casas', methods=['GET'])
def listar_casas():
    return jsonify(cargar_datos())

@app.route('/agregar_casa', methods=['POST'])
def agregar_casa():
    nueva_casa = request.json
    casas = cargar_datos()

    # Generar un ID único automáticamente
    max_id = max((c.get('id', 0) for c in casas), default=0)
    nueva_casa['id'] = max_id + 1

    # Asignar nombre automáticamente
    nueva_casa['nombre'] = f"casa {nueva_casa['id']}"

    casas.append(nueva_casa)
    guardar_datos(casas)

    # Reconstruir KD-Tree
    reconstruir_kdtree()

    return jsonify({"status": "ok", "id": nueva_casa['id']})

@app.route('/buscar', methods=['POST'])
def buscar():
    try:
        data = request.get_json() or {}

        # Campos recibidos desde frontend
        direccion = str(data.get("direccion", "")).strip().lower()
        numero = str(data.get("numero", "")).strip()
        coords = str(data.get("coords", "")).strip()

        casas = cargar_datos()
        resultados = []

        for casa in casas:
            coincide = False

            # 1) Buscar por número (id)
            if numero and str(casa.get("id", "")).strip() == numero:
                coincide = True

            # 2) Buscar por calle (solo la propiedad 'calle')
            elif direccion:
                dir_field = casa.get("direccion", "")

                if isinstance(dir_field, dict):
                    calle_casa = str(dir_field.get("calle", "")).lower()
                else:
                    calle_casa = str(dir_field).lower()

                if direccion in calle_casa:
                    coincide = True

            # 3) (opcional) búsqueda por coordenadas - si envías coords implementa proximidad
            # if coords:
            #     try:
            #         lat_c, lon_c, radio = map(float, coords.split(","))
            #         lat = float(casa.get("latitud", 0))
            #         lon = float(casa.get("longitud", 0))
            #         distancia = ((lat - lat_c)**2 + (lon - lon_c)**2)**0.5
            #         if distancia <= radio:
            #             coincide = True
            #     except Exception as e:
            #         pass

            if coincide:
                resultados.append(casa)

        print(f"[BUSCAR] direccion='{direccion}', numero='{numero}', resultados={len(resultados)}")
        return jsonify({"resultados": resultados, "total": len(resultados)})

    except Exception as e:
        print("❌ Error en /buscar:", e)
        return jsonify({"error": str(e)}), 500

# =====================
# Endpoint KD-Tree: Buscar casas cercanas
# =====================
@app.route('/buscar_cercanas', methods=['POST'])
def buscar_cercanas():
    try:
        data = request.get_json()
        numero_str = str(data.get("numero", "")).strip()
        radio_metros = float(data.get("radio", 0))

        if not numero_str:
            return jsonify({"error": "Debe ingresar un número de casa"}), 400

        # Convertimos a entero y validamos
        try:
            numero = int(numero_str)
        except ValueError:
            return jsonify({"error": "Número de casa inválido"}), 400

        casas = cargar_datos()

        # Filtramos solo casas válidas (con id, latitud y longitud)
        casas_validas = [c for c in casas if c.get("id") is not None 
            and c.get("latitud") is not None 
            and c.get("longitud") is not None]

        if not casas_validas:
            return jsonify({"error": "No hay casas con coordenadas válidas"}), 500

        # Encontrar la casa de referencia
        casa_ref = next((c for c in casas_validas if c.get("id") == numero), None)
        if not casa_ref:
            return jsonify({"error": f"Casa con id {numero} no encontrada"}), 404

        # Reconstruir KDTree
        reconstruir_kdtree()
        if not kd_tree or not coordenadas:
            return jsonify({"resultados": []})

        lat_ref, lon_ref = casa_ref.get("latitud"), casa_ref.get("longitud")
        if lat_ref is None or lon_ref is None:
            return jsonify({"error": "Casa de referencia no tiene coordenadas"}), 500

        # =====================
        # Convertir radio en metros a grados
        # =====================
        # 1 grado latitud ≈ 111.32 km
        radio_lat = radio_metros / 111320.0
        # 1 grado longitud ≈ 111.32 km * cos(latitud)
        radio_lon = radio_metros / (111320.0 * math.cos(math.radians(lat_ref)))
        # Tomamos el mayor para usar un círculo aproximado
        radio_grados = max(radio_lat, radio_lon)

        # Buscar casas cercanas usando KD-Tree
        indices = kd_tree.query_ball_point([lat_ref, lon_ref], r=radio_grados)

        resultados = [casa_ref]  # empezamos incluyendo la casa central

        for i in indices:
            casa = casas[i]
            if casa.get("id") is not None:  # ya no excluimos la casa de referencia
                # calcular distancia real
                lat_c, lon_c = casa.get("latitud"), casa.get("longitud")
                delta_lat = (lat_c - lat_ref) * 111320
                delta_lon = (lon_c - lon_ref) * 111320 * math.cos(math.radians(lat_ref))
                distancia_m = math.sqrt(delta_lat**2 + delta_lon**2)
                if distancia_m <= radio_metros:
                    # evitar duplicados
                    if casa not in resultados:
                        resultados.append(casa)

        print(f"[KDTree] Casa ref id={casa_ref.get('id')}, cercanas: {[c.get('id') for c in resultados]}")

        return jsonify({"resultados": resultados})

    except Exception as e:
        print("❌ Error en /buscar_cercanas:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/editar_casa', methods=['POST'])
def editar_casa():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se enviaron datos"}), 400

        casa_id = data.get('id')
        if casa_id is None:
            return jsonify({"error": "Falta el id de la casa"}), 400

        casas = cargar_datos()
        encontrado = False
        for i, c in enumerate(casas):
            if c.get('id') == casa_id:
                # Actualizar campos simples
                casas[i]['nombre'] = data.get('nombre', c.get('nombre'))
                casas[i]['latitud'] = data.get('latitud', c.get('latitud'))
                casas[i]['longitud'] = data.get('longitud', c.get('longitud'))
                casas[i]['propietario'] = data.get('propietario', c.get('propietario'))
                casas[i]['valor_catastral'] = data.get('valor_catastral', c.get('valor_catastral'))
                casas[i]['impuesto_anual'] = data.get('impuesto_anual', c.get('impuesto_anual'))

                # Dirección (asegurar dict)
                dir_new = data.get('direccion')
                if dir_new:
                    casas[i]['direccion'] = {
                        "calle": dir_new.get('calle', c.get('direccion', {}).get('calle') if isinstance(c.get('direccion'), dict) else c.get('direccion')),
                        "numero": dir_new.get('numero', c.get('direccion', {}).get('numero') if isinstance(c.get('direccion'), dict) else None),
                        "barrio": dir_new.get('barrio', c.get('direccion', {}).get('barrio') if isinstance(c.get('direccion'), dict) else None),
                        "distrito": dir_new.get('distrito', c.get('direccion', {}).get('distrito') if isinstance(c.get('direccion'), dict) else None)
                    }

                # Pagos: si vienen en payload, reemplazamos; si no, dejamos los viejos
                if 'pagos' in data and isinstance(data['pagos'], list):
                    casas[i]['pagos'] = data['pagos']

                encontrado = True
                break

        if not encontrado:
            return jsonify({"error": f"Casa con id {casa_id} no encontrada"}), 404

        guardar_datos(casas)
        reconstruir_kdtree()
        return jsonify({"status": "ok", "id": casa_id})

    except Exception as e:
        print("❌ Error en /editar_casa:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/eliminar_casa', methods=['POST'])
def eliminar_casa():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se enviaron datos"}), 400

        casa_id = data.get('id')
        if casa_id is None:
            return jsonify({"error": "Falta el id de la casa"}), 400

        casas = cargar_datos()
        nuevas = [c for c in casas if c.get('id') != casa_id]

        if len(nuevas) == len(casas):
            return jsonify({"error": f"Casa con id {casa_id} no encontrada"}), 404

        guardar_datos(nuevas)
        reconstruir_kdtree()
        return jsonify({"status": "ok", "id": casa_id})

    except Exception as e:
        print("❌ Error en /eliminar_casa:", e)
        return jsonify({"error": str(e)}), 500


# =====================
# Ejecutar app
# =====================
if __name__ == '__main__':
    app.run(debug=True)
